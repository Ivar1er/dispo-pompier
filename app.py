from flask import Flask, render_template, redirect, url_for, request, flash, jsonify, session, Response
from flask_sqlalchemy import SQLAlchemy
from flask_login import (
    LoginManager,
    UserMixin,
    login_user,
    login_required,
    logout_user,
    current_user,
)
from werkzeug.security import generate_password_hash, check_password_hash
import os
import threading
from datetime import datetime, timedelta, time, date as date_cls
import secrets
import string
from sqlalchemy import inspect, text


app = Flask(__name__)

# ----------------------------
# Configuration
# ----------------------------
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "pompier-secret-blr-2026")

db_url = os.environ.get("DATABASE_URL", "sqlite:///caserne.db")
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

app.config["SQLALCHEMY_DATABASE_URI"] = db_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

login_manager = LoginManager(app)
login_manager.login_view = "login"


# ----------------------------
# Mini-migrations (Render / DB déjà existante)
# ----------------------------
def _ensure_columns(table_name: str, columns: dict):
    """Ajoute des colonnes manquantes sur une base déjà existante.

    Compatible SQLite/PostgreSQL via INFORMATION_SCHEMA (SQLAlchemy inspector).
    """
    try:
        insp = inspect(db.engine)
        if table_name not in insp.get_table_names():
            return

        existing = {c["name"] for c in insp.get_columns(table_name)}
        missing = [(name, coltype) for name, coltype in columns.items() if name not in existing]
        if not missing:
            return

        # "user" est un mot réservé en PostgreSQL : on le quote.
        dialect = db.engine.dialect.name
        tbl = f'"{table_name}"' if (dialect in ("postgresql", "postgres") and table_name.lower() == "user") else table_name

        for name, coltype in missing:
            db.session.execute(text(f"ALTER TABLE {tbl} ADD COLUMN {name} {coltype}"))
        db.session.commit()
    except Exception:
        # En cas d'échec, on évite de casser le démarrage (les logs Render aideront si besoin)
        db.session.rollback()


def ensure_schema():
    """Garantit que les colonnes attendues existent (utile après mise à jour)."""
    # Colonnes ajoutées au fil des versions
    _ensure_columns("user", {
        "nom": "VARCHAR(120) DEFAULT ''",
        "prenom": "VARCHAR(120) DEFAULT ''",
        "email": "VARCHAR(255) DEFAULT ''",
    })


# ----------------------------
# Initialisation BDD (Flask 3+)
# ----------------------------
# Flask 3 a supprimé @app.before_first_request.
# On initialise donc la BDD au premier appel avec un garde "run once"
# (une fois par worker Gunicorn).
_db_init_lock = threading.Lock()
_db_initialized = False

def _init_db():
    """Crée les tables et applique les évolutions de schéma si nécessaire."""
    db.create_all()
    ensure_schema()

@app.before_request
def _init_db_once():
    global _db_initialized
    if _db_initialized:
        return
    with _db_init_lock:
        if _db_initialized:
            return
        _init_db()
        _db_initialized = True

# ----------------------------
# Modèles
# ----------------------------
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(20), default="agent")
    must_change_password = db.Column(db.Boolean, default=True)

    # Profil agent (sert pour inscriptions auto + notifications)
    nom = db.Column(db.String(120), default="", nullable=False)
    prenom = db.Column(db.String(120), default="", nullable=False)
    email = db.Column(db.String(255), default="", nullable=False)


class Availability(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False)
    status = db.Column(db.String(20), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    user = db.relationship("User", backref=db.backref("availabilities", lazy=True))


class TimeSlot(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    start_dt = db.Column(db.DateTime, nullable=False)
    end_dt = db.Column(db.DateTime, nullable=False)
    status = db.Column(db.String(20), nullable=False)  # disponible / indisponible / astreinte
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    user = db.relationship("User", backref=db.backref("time_slots", lazy=True))


# ----------------------------
# Manoeuvre Mensuel
# ----------------------------
class ManoeuvreMensuelle(db.Model):
    __tablename__ = "manoeuvre_mensuelle"
    id = db.Column(db.Integer, primary_key=True)
    titre = db.Column(db.String(200), nullable=False)
    date_manoeuvre = db.Column(db.Date, nullable=False)
    desc_suap = db.Column(db.Text, default="", nullable=False)
    desc_incdv = db.Column(db.Text, default="", nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    createur = db.relationship("User", backref=db.backref("manoeuvres", lazy=True))


class ManoeuvreRessource(db.Model):
    __tablename__ = "manoeuvre_ressource"
    id = db.Column(db.Integer, primary_key=True)
    manoeuvre_id = db.Column(db.Integer, db.ForeignKey("manoeuvre_mensuelle.id"), nullable=False)
    label = db.Column(db.String(200), default="", nullable=False)
    url = db.Column(db.Text, nullable=False)

    manoeuvre = db.relationship(
        "ManoeuvreMensuelle",
        backref=db.backref("ressources", cascade="all, delete-orphan", lazy=True),
    )


class ManoeuvreInscription(db.Model):
    __tablename__ = "manoeuvre_inscription"
    id = db.Column(db.Integer, primary_key=True)
    manoeuvre_id = db.Column(db.Integer, db.ForeignKey("manoeuvre_mensuelle.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    nom = db.Column(db.String(120), nullable=False)
    prenom = db.Column(db.String(120), nullable=False)
    statut = db.Column(db.String(10), nullable=False)  # PRESENT / ABSENT
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    manoeuvre = db.relationship(
        "ManoeuvreMensuelle",
        backref=db.backref("inscriptions", cascade="all, delete-orphan", lazy=True),
    )
    user = db.relationship("User", backref=db.backref("manoeuvre_inscriptions", lazy=True))



@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


def _ensure_user_profile_columns():
    """Ajoute les colonnes profil dans la table user si elles n'existent pas.

    Le projet n'utilise pas Alembic; on fait une migration légère au démarrage.
    Compatible SQLite / Postgres.
    """
    engine = db.engine
    dialect = engine.dialect.name

    def _has_column(col_name: str) -> bool:
        if dialect == "sqlite":
            rows = db.session.execute(db.text("PRAGMA table_info(user)"))
            return any(r[1] == col_name for r in rows)
        rows = db.session.execute(
            db.text(
                """
                SELECT column_name FROM information_schema.columns
                WHERE table_name='user' AND column_name=:c
                """
            ),
            {"c": col_name},
        )
        return rows.first() is not None

    additions = [
        ("nom", "VARCHAR(120)", "''"),
        ("prenom", "VARCHAR(120)", "''"),
        ("email", "VARCHAR(255)", "''"),
    ]
    for col, typ, default in additions:
        if not _has_column(col):
            db.session.execute(db.text(f"ALTER TABLE \"user\" ADD COLUMN {col} {typ} DEFAULT {default}"))
    db.session.commit()


def get_latest_manoeuvre_for_user():
    """Retourne la prochaine manoeuvre (>= aujourd'hui) sinon la plus récente."""
    today = datetime.now().date()
    m = (
        ManoeuvreMensuelle.query.filter(ManoeuvreMensuelle.date_manoeuvre >= today)
        .order_by(ManoeuvreMensuelle.date_manoeuvre.asc())
        .first()
    )
    if m is None:
        m = ManoeuvreMensuelle.query.order_by(ManoeuvreMensuelle.date_manoeuvre.desc()).first()
    return m


def send_email_message(recipients, subject: str, body: str) -> bool:
    """Envoi email simple via SMTP. Retourne True si l'envoi a réussi."""
    smtp_host = os.environ.get("SMTP_HOST")
    smtp_user = os.environ.get("SMTP_USER")
    smtp_pass = os.environ.get("SMTP_PASS")
    smtp_from = os.environ.get("SMTP_FROM") or smtp_user
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))

    if isinstance(recipients, str):
        recipients = [recipients]

    recipients = sorted({(r or "").strip() for r in recipients if (r or "").strip()})
    if not smtp_host or not smtp_from or not recipients:
        return False

    try:
        import smtplib
        from email.message import EmailMessage

        msg = EmailMessage()
        msg["From"] = smtp_from
        msg["To"] = ", ".join(recipients)
        msg["Subject"] = subject
        msg.set_content(body)

        with smtplib.SMTP(smtp_host, smtp_port) as s:
            s.starttls()
            if smtp_user and smtp_pass:
                s.login(smtp_user, smtp_pass)
            s.send_message(msg)
        return True
    except Exception:
        return False


def generate_temporary_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))


def notify_agents_manoeuvre_created(manoeuvre: "ManoeuvreMensuelle"):
    """Envoie un email aux agents ayant renseigné une adresse.

    Optionnel: si SMTP_* n'est pas configuré, on n'envoie rien (pas d'erreur).
    """

    # On notifie uniquement les agents avec un profil complet (nom/prénom) et une adresse email.
    agents = User.query.filter_by(role="agent").all()
    recipients = [
        (u.email or "").strip()
        for u in agents
        if (u.email or "").strip() and (u.nom or "").strip() and (u.prenom or "").strip()
    ]
    # Dé-doublonnage simple
    recipients = sorted(set(recipients))
    if not recipients:
        return

    subject = f"[Caserne BLR] Nouvelle manoeuvre mensuelle : {manoeuvre.titre}"
    body = (
        "Bonjour,\n\n"
        "Une nouvelle manoeuvre mensuelle a été publiée.\n\n"
        f"Titre : {manoeuvre.titre}\n"
        f"Date : {manoeuvre.date_manoeuvre.strftime('%d/%m/%Y')}\n\n"
        "Connectez-vous pour consulter les ressources et vous inscrire.\n"
    )

    send_email_message(recipients, subject, body)


def notify_agents_manoeuvre_updated(manoeuvre):
    """Quand un admin met à jour une manoeuvre, on notifie les agents.

    Même logique que lors de la création mais avec un sujet différent.
    """

    agents = User.query.filter_by(role="agent").all()
    recipients = [
        (u.email or "").strip()
        for u in agents
        if (u.email or "").strip()
        and (u.nom or "").strip()
        and (u.prenom or "").strip()
    ]
    recipients = sorted(set(recipients))
    if not recipients:
        return

    subject = f"[Caserne BLR] Manoeuvre mise à jour : {manoeuvre.titre}"
    body = (
        "Bonjour,\n\n"
        "Une manoeuvre mensuelle a été mise à jour par l'administrateur.\n\n"
        f"Titre : {manoeuvre.titre}\n"
        f"Date : {manoeuvre.date_manoeuvre.strftime('%d/%m/%Y')}\n\n"
        "Connectez-vous pour consulter les informations et les ressources.\n"
    )

    send_email_message(recipients, subject, body)



# ----------------------------
# Helpers
# ----------------------------
def operational_window(day_date):
    """Fenêtre opérationnelle: day_date 07:00 -> day_date+1 07:00"""
    start = datetime.combine(day_date, time(7, 0))
    end = start + timedelta(days=1)
    return start, end


def weekend_window(anchor_date: date_cls):
    """
    Fenêtre week-end demandée:
    du samedi 07:00 à lundi 06:59 (=> lundi 07:00 exclus)

    On prend le samedi du week-end "contenant" anchor_date:
    - si anchor_date est samedi/dimanche/lundi: on remonte au samedi précédent
    - sinon (mar..ven): on remonte au samedi précédent aussi (week-end le plus récent)
    """
    # Python: Monday=0 ... Sunday=6
    # Saturday=5
    days_since_saturday = (anchor_date.weekday() - 5) % 7
    sat_date = anchor_date - timedelta(days=days_since_saturday)

    start = datetime.combine(sat_date, time(7, 0))
    end = start + timedelta(days=2)  # Monday 07:00
    return sat_date, start, end


def parse_date(date_str):
    return datetime.strptime(date_str, "%Y-%m-%d").date()


def parse_hhmm(hhmm):
    return datetime.strptime(hhmm, "%H:%M").time()


def upsert_daily_availability(user_id, day_date, status):
    existing = Availability.query.filter_by(user_id=user_id, date=day_date).first()
    if existing:
        existing.status = status
    else:
        db.session.add(Availability(date=day_date, status=status, user_id=user_id))


def merge_slots_into_ranges(slots, window_start=None, window_end=None):
    """
    Regroupe des TimeSlot en plages:
    - fusionne si même status ET chevauchement/contiguïté (next.start <= current.end)
    - option window_start/end: on clip avant regroupement
    Retour: [{start_dt,end_dt,status,slot_ids}]
    """
    if not slots:
        return []

    prepared = []
    for s in slots:
        st = s.start_dt
        en = s.end_dt

        if window_start is not None:
            st = max(st, window_start)
        if window_end is not None:
            en = min(en, window_end)

        if en <= st:
            continue

        prepared.append((st, en, s.status, s.id))

    if not prepared:
        return []

    prepared.sort(key=lambda x: (x[0], x[1], x[2], x[3]))

    ranges = []
    cur_start, cur_end, cur_status, cur_ids = prepared[0][0], prepared[0][1], prepared[0][2], [prepared[0][3]]

    for st, en, status, sid in prepared[1:]:
        if status == cur_status and st <= cur_end:
            cur_end = max(cur_end, en)
            cur_ids.append(sid)
        else:
            ranges.append({"start_dt": cur_start, "end_dt": cur_end, "status": cur_status, "slot_ids": cur_ids})
            cur_start, cur_end, cur_status, cur_ids = st, en, status, [sid]

    ranges.append({"start_dt": cur_start, "end_dt": cur_end, "status": cur_status, "slot_ids": cur_ids})
    return ranges


def overlap_seconds(a_start, a_end, b_start, b_end):
    """Durée d'intersection en secondes entre [a_start,a_end] et [b_start,b_end]"""
    s = max(a_start, b_start)
    e = min(a_end, b_end)
    if e <= s:
        return 0
    return int((e - s).total_seconds())


# ----------------------------
# Routes
# ----------------------------
@app.route("/")
def index():
    return redirect(url_for("login"))


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        user = User.query.filter_by(username=request.form["username"]).first()
        if user and check_password_hash(user.password, request.form["password"]):
            login_user(user)
            if user.must_change_password:
                return redirect(url_for("change_password"))
            return redirect(url_for("dashboard"))
        flash("Erreur de connexion : Identifiant ou mot de passe incorrect")

    return render_template("login.html")


@app.route("/forgot-password", methods=["POST"])
def forgot_password():
    email = (request.form.get("email") or "").strip().lower()

    smtp_host = os.environ.get("SMTP_HOST")
    smtp_from = os.environ.get("SMTP_FROM") or os.environ.get("SMTP_USER")
    if not smtp_host or not smtp_from:
        flash("Réinitialisation indisponible : la messagerie n'est pas configurée.")
        return redirect(url_for("login"))

    if not email:
        flash("Merci de renseigner votre adresse email.")
        return redirect(url_for("login"))

    user = User.query.filter(db.func.lower(User.email) == email).first()
    if user:
        temporary_password = generate_temporary_password()
        previous_password = user.password
        previous_flag = user.must_change_password

        user.password = generate_password_hash(temporary_password, method="pbkdf2:sha256")
        user.must_change_password = True

        subject = "[Caserne BLR] Réinitialisation de votre mot de passe"
        body = (
            f"Bonjour {user.prenom or user.username},\n\n"
            "Un mot de passe provisoire a été généré pour votre compte.\n\n"
            f"Identifiant : {user.username}\n"
            f"Mot de passe provisoire : {temporary_password}\n\n"
            "Connectez-vous avec ce mot de passe provisoire puis changez-le immédiatement à la première connexion.\n"
        )

        if not send_email_message(user.email, subject, body):
            user.password = previous_password
            user.must_change_password = previous_flag
            db.session.rollback()
            flash("Impossible d'envoyer l'email pour le moment. Merci de réessayer plus tard.")
            return redirect(url_for("login"))

        db.session.commit()

    flash("Si un compte est associé à cet email, un mot de passe provisoire vient d'être envoyé.")
    return redirect(url_for("login"))


@app.route("/dashboard")
@login_required
def dashboard():
    latest = get_latest_manoeuvre_for_user()

    # Notification in-app : on affiche si nouvelle manoeuvre non consultée
    notif = None
    if latest:
        seen_id = session.get("seen_manoeuvre_id")
        if seen_id != latest.id:
            notif = {
                "id": latest.id,
                "titre": latest.titre,
                "date": latest.date_manoeuvre,
            }

    profile_incomplete = (not (current_user.nom or "").strip()) or (not (current_user.prenom or "").strip())

    return render_template(
        "dashboard.html",
        notif=notif,
        profile_incomplete=profile_incomplete,
    )


@app.route("/profil", methods=["GET", "POST"])
@login_required
def profil():
    if request.method == "POST":
        current_user.nom = (request.form.get("nom") or "").strip()
        current_user.prenom = (request.form.get("prenom") or "").strip()
        current_user.email = (request.form.get("email") or "").strip()

        db.session.commit()
        flash("Profil mis à jour.")
        return redirect(url_for("dashboard"))

    return render_template("profil.html")


@app.route("/ma-dispo", methods=["GET", "POST"])
@login_required
def ma_dispo():
    today = datetime.now().date()
    selected_date_str = request.args.get("date")
    selected_date = parse_date(selected_date_str) if selected_date_str else today

    # Les agents ne peuvent pas consulter/saisir sur une date passée
    if current_user.role != "admin" and selected_date < today:
        flash("Impossible de sélectionner une date passée.")
        return redirect(url_for("ma_dispo", date=today.strftime("%Y-%m-%d")))

    if request.method == "POST":
        date_obj = parse_date(request.form["date"])
        status = "disponible"
        # (Simplification) On ne gère plus astreinte/indisponible via l'UI.

        if current_user.role != "admin" and date_obj < today:
            flash("Impossible de modifier une date passée.")
            return redirect(url_for("ma_dispo", date=today.strftime("%Y-%m-%d")))

        if request.form.get("start_time") and request.form.get("end_time"):
            start_t = parse_hhmm(request.form["start_time"])
            end_t = parse_hhmm(request.form["end_time"])

            start_dt = datetime.combine(date_obj, start_t)
            end_dt = datetime.combine(date_obj, end_t)

            if end_dt <= start_dt:
                end_dt = end_dt + timedelta(days=1)

            w_start, w_end = operational_window(date_obj)
            if not (w_start <= start_dt < w_end and w_start < end_dt <= w_end):
                flash("Créneau hors plage (07:00 → 07:00).")
                return redirect(url_for("ma_dispo", date=date_obj.strftime("%Y-%m-%d")))

            db.session.add(TimeSlot(
                user_id=current_user.id,
                start_dt=start_dt,
                end_dt=end_dt,
                status=status,
            ))

            upsert_daily_availability(current_user.id, date_obj, status)

            db.session.commit()
            flash("Créneau ajouté.")
            return redirect(url_for("ma_dispo", date=date_obj.strftime("%Y-%m-%d")))

        # Journée complète
        w_start, w_end = operational_window(date_obj)
        db.session.add(TimeSlot(
            user_id=current_user.id,
            start_dt=w_start,
            end_dt=w_end,
            status=status,
        ))

        upsert_daily_availability(current_user.id, date_obj, status)

        db.session.commit()
        flash("Disponibilité enregistrée (journée complète).")
        return redirect(url_for("ma_dispo", date=date_obj.strftime("%Y-%m-%d")))

    dispos = (
        Availability.query.filter_by(user_id=current_user.id)
        .order_by(Availability.date.desc())
        .all()
    )

    w_start, w_end = operational_window(selected_date)

    day_slots = (
        TimeSlot.query.filter(
            TimeSlot.user_id == current_user.id,
            TimeSlot.start_dt < w_end,
            TimeSlot.end_dt > w_start,
        )
        .order_by(TimeSlot.start_dt.asc())
        .all()
    )

    day_ranges = merge_slots_into_ranges(day_slots, window_start=w_start, window_end=w_end)

    # Indices (0-47) des créneaux de 30 min déjà existants dans la fenêtre 07:00 → 07:00
    existing_indices_set = set()
    for sl in day_slots:
        # On ne bloque que sur la grille "30 min" : on découpe l'intersection en pas de 30 min
        s = max(sl.start_dt, w_start)
        e = min(sl.end_dt, w_end)
        if e <= s:
            continue
        cursor = s
        # Aligne au pas de 30 min (au cas où)
        minutes = int((cursor - w_start).total_seconds() // 60)
        if minutes % 30 != 0:
            cursor = w_start + timedelta(minutes=(minutes // 30) * 30)
        while cursor < e:
            idx = int((cursor - w_start).total_seconds() // (30 * 60))
            if 0 <= idx <= 47:
                existing_indices_set.add(idx)
            cursor += timedelta(minutes=30)

    existing_indices = sorted(existing_indices_set)


    return render_template(
        "ma_dispo.html",
        dispos=dispos,
        selected_date=selected_date,
        today=today,
        day_slots=day_slots,
        day_ranges=day_ranges,
        window_start=w_start,
        existing_indices=existing_indices,
        window_end=w_end,
    )


@app.route("/ma-dispo/delete-slot/<int:slot_id>", methods=["POST"])
@login_required
def delete_slot(slot_id):
    slot = TimeSlot.query.get_or_404(slot_id)

    if slot.user_id != current_user.id and current_user.role != "admin":
        return "Accès interdit", 403

    day_date = slot.start_dt.date()

    today = datetime.now().date()
    if current_user.role != "admin" and day_date < today:
        flash("Impossible de modifier une date passée.")
        return redirect(url_for("ma_dispo", date=today.strftime("%Y-%m-%d")))
    db.session.delete(slot)
    db.session.commit()
    flash("Créneau supprimé.")
    return redirect(url_for("ma_dispo", date=day_date.strftime("%Y-%m-%d")))


@app.route("/ma-dispo/delete-range", methods=["POST"])
@login_required
def delete_range():
    slot_ids_str = (request.form.get("slot_ids") or "").strip()
    date_str = (request.form.get("date") or "").strip()

    if not slot_ids_str:
        flash("Aucun créneau à supprimer.")
        return redirect(url_for("ma_dispo", date=date_str)) if date_str else redirect(url_for("ma_dispo"))

    ids = []
    for part in slot_ids_str.split(","):
        part = part.strip()
        if part.isdigit():
            ids.append(int(part))

    if not ids:
        flash("Aucun créneau valide à supprimer.")
        return redirect(url_for("ma_dispo", date=date_str)) if date_str else redirect(url_for("ma_dispo"))

    slots = TimeSlot.query.filter(TimeSlot.id.in_(ids)).all()

    today = datetime.now().date()
    if current_user.role != "admin":
        # Blocage modification d'une date passée
        if any(sl.start_dt.date() < today for sl in slots):
            flash("Impossible de modifier une date passée.")
            return redirect(url_for("ma_dispo", date=today.strftime("%Y-%m-%d")))

    if current_user.role != "admin":
        for sl in slots:
            if sl.user_id != current_user.id:
                return "Accès interdit", 403

    deleted = 0
    for sl in slots:
        db.session.delete(sl)
        deleted += 1

    db.session.commit()
    flash(f"Plage supprimée ({deleted} créneau(x)).")

    return redirect(url_for("ma_dispo", date=date_str)) if date_str else redirect(url_for("ma_dispo"))


@app.route("/ma-dispo/bulk", methods=["POST"])
@login_required
def dispo_bulk():
    data = request.get_json(force=True) or {}
    date_str = data.get("date")
    indices = data.get("indices", [])

    if not date_str or not isinstance(indices, list):
        return jsonify({"ok": False, "error": "payload invalide"}), 400

    day_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    today = datetime.now().date()
    if current_user.role != "admin" and day_date < today:
        return jsonify({"ok": False, "error": "date passée"}), 400
    window_start, window_end = operational_window(day_date)

    clean = sorted({int(i) for i in indices if 0 <= int(i) <= 47})
    if not clean:
        return jsonify({"ok": True, "created": 0})

    created = 0
    for i in clean:
        start_dt = window_start + timedelta(minutes=30 * i)
        end_dt = start_dt + timedelta(minutes=30)

        exists = TimeSlot.query.filter_by(
            user_id=current_user.id,
            start_dt=start_dt,
            end_dt=end_dt,
            status="disponible",
        ).first()

        if not exists:
            db.session.add(TimeSlot(
                user_id=current_user.id,
                start_dt=start_dt,
                end_dt=end_dt,
                status="disponible",
            ))
            created += 1

    upsert_daily_availability(current_user.id, day_date, "disponible")

    db.session.commit()
    return jsonify({"ok": True, "created": created})


@app.route("/admin/agents", methods=["GET", "POST"])
@login_required
def admin_agents():
    if current_user.role != "admin":
        return "Accès interdit", 403

    if request.method == "POST":
        username = request.form["username"].strip()
        role = request.form["role"]

        if not User.query.filter_by(username=username).first():
            hashed_pw = generate_password_hash("Pompier123!", method="pbkdf2:sha256")
            new_user = User(
                username=username,
                password=hashed_pw,
                role=role,
                must_change_password=True,
            )
            db.session.add(new_user)
            db.session.commit()
            flash(f"Agent {username} créé avec succès !")
        else:
            flash("Cet identifiant existe déjà.")

    return render_template("admin_agents.html", agents=User.query.all())


@app.route("/admin/agents/<int:user_id>/delete", methods=["POST"])
@login_required
def admin_delete_agent(user_id: int):
    """Suppression d'un compte agent.

    On supprime aussi ses créneaux et disponibilités pour éviter les contraintes FK.
    Les inscriptions manoeuvre sont conservées (user_id mis à NULL) pour garder
    l'historique nominatif.
    """
    if current_user.role != "admin":
        return "Accès interdit", 403

    user = User.query.get_or_404(user_id)

    if user.role != "agent":
        flash("Seuls les comptes agents peuvent être supprimés ici.")
        return redirect(url_for("admin_agents"))

    # Nettoyage données liées
    Availability.query.filter_by(user_id=user.id).delete(synchronize_session=False)
    TimeSlot.query.filter_by(user_id=user.id).delete(synchronize_session=False)

    # Conserver l'historique d'inscription (nom/prénom déjà stockés)
    ManoeuvreInscription.query.filter_by(user_id=user.id).update({"user_id": None}, synchronize_session=False)

    db.session.delete(user)
    db.session.commit()
    flash("Compte agent supprimé.")
    return redirect(url_for("admin_agents"))


@app.route("/admin/synthese")
@login_required
def admin_synthese():
    if current_user.role != "admin":
        return "Accès interdit", 403

    selected = request.args.get("date")
    selected_date = datetime.strptime(selected, "%Y-%m-%d").date() if selected else datetime.now().date()

    window_start = datetime.combine(selected_date, time(7, 0))
    window_end = window_start + timedelta(days=1)
    window_seconds = 24 * 60 * 60

    total_users = User.query.count()
    total_slots = TimeSlot.query.count()

    total_dispos = Availability.query.count()
    last = Availability.query.order_by(Availability.date.desc()).first()
    last_update = last.date.strftime("%d/%m/%Y") if last else None

    slots = (
        TimeSlot.query
        .filter(TimeSlot.start_dt < window_end, TimeSlot.end_dt > window_start)
        .all()
    )

    def status_class(st):
        return "bg-success" if st == "disponible" else "bg-secondary"

    # Segments timeline + plages lisibles
    segments_by_user = {}
    ranges_text_by_user = {}

    # Groupe par user pour ensuite fusionner en plages "lisibles"
    slots_by_user = {}
    for sl in slots:
        slots_by_user.setdefault(sl.user_id, []).append(sl)

        s = max(sl.start_dt, window_start)
        e = min(sl.end_dt, window_end)
        if e <= s:
            continue

        left = (s - window_start).total_seconds() / window_seconds * 100.0
        width = (e - s).total_seconds() / window_seconds * 100.0
        title = f"{sl.user.username} — {s.strftime('%H:%M')} → {e.strftime('%H:%M')} ({sl.status})"

        segments_by_user.setdefault(sl.user_id, []).append({
            "left": left,
            "width": width,
            "cls": status_class(sl.status),
            "title": title
        })

    for uid in segments_by_user:
        segments_by_user[uid].sort(key=lambda x: x["left"])

    # Fabrique une liste de plages par user (fusionnées)
    for uid, user_slots in slots_by_user.items():
        merged = merge_slots_into_ranges(user_slots, window_start=window_start, window_end=window_end)
        texts = []
        for r in merged:
            cross = (r["end_dt"].date() != r["start_dt"].date())
            texts.append({
                "start_hm": r["start_dt"].strftime("%H:%M"),
                "end_hm": r["end_dt"].strftime("%H:%M"),
                "status": r["status"],
                "cross": cross,
            })
        ranges_text_by_user[uid] = texts

    users = User.query.order_by(User.username.asc()).all()
    recent_slots = TimeSlot.query.order_by(TimeSlot.id.desc()).limit(10).all()

    return render_template(
        "admin_synthese.html",
        total_users=total_users,
        total_slots=total_slots,
        total_dispos=total_dispos,
        last_update=last_update,
        selected_date=selected_date,
        window_start=window_start,
        window_end=window_end,
        users=users,
        segments_by_user=segments_by_user,
        ranges_text_by_user=ranges_text_by_user,   # NOUVEAU
        recent_slots=recent_slots,
        timedelta=timedelta,
    )


@app.route("/admin/volume-horaire", methods=["GET"])
@login_required
def admin_volume_horaire():
    """
    Volume horaire du week-end:
    samedi 07:00 -> lundi 06:59 (lundi 07:00 exclus)
    On calcule les heures par agent et par statut (disponible / indisponible).
    """
    if current_user.role != "admin":
        return "Accès interdit", 403

    mode = (request.args.get("mode") or "weekend").lower()  # weekend | month

    # --- Mode "Mois" : comparaison des week-ends du mois (heures DISPONIBLES) ---
    if mode == "month":
        month_str = request.args.get("month")
        if month_str:
            # input type="month" => YYYY-MM
            month_start = datetime.strptime(month_str + "-01", "%Y-%m-%d").date()
        else:
            today = datetime.now().date()
            month_start = date_cls(today.year, today.month, 1)

        # bornes du mois
        if month_start.month == 12:
            month_end = date_cls(month_start.year + 1, 1, 1)
        else:
            month_end = date_cls(month_start.year, month_start.month + 1, 1)

        # Liste des samedis du mois (week-ends à comparer)
        days_to_sat = (5 - month_start.weekday()) % 7
        first_sat = month_start + timedelta(days=days_to_sat)
        saturdays = []
        d = first_sat
        while d < month_end:
            saturdays.append(d)
            d += timedelta(days=7)

        weekend_windows = []  # [{idx,label,sat,start,end}]
        for i, sat in enumerate(saturdays, start=1):
            start = datetime.combine(sat, time(7, 0))
            end = start + timedelta(days=2)  # lundi 07:00
            weekend_windows.append({
                "idx": i,
                "label": f"Week-end {i}",
                "sat": sat,
                "start": start,
                "end": end,
            })

        if weekend_windows:
            global_start = weekend_windows[0]["start"]
            global_end = weekend_windows[-1]["end"]
        else:
            global_start = datetime.combine(month_start, time(7, 0))
            global_end = datetime.combine(month_end, time(7, 0))

        slots = TimeSlot.query.filter(TimeSlot.start_dt < global_end, TimeSlot.end_dt > global_start).all()

        # Comparaison surtout pour les agents (pas les admins)
        users = User.query.filter_by(role="agent").order_by(User.username.asc()).all()

        # uid -> we_idx -> seconds (disponible)
        agg = {u.id: {w["idx"]: 0 for w in weekend_windows} for u in users}

        for sl in slots:
            if sl.user_id not in agg:
                continue
            # on ne garde que la disponibilité (astreinte comptée comme dispo si jamais elle existe encore)
            st = sl.status
            if st == "astreinte":
                st = "disponible"
            if st != "disponible":
                continue

            for w in weekend_windows:
                secs = overlap_seconds(sl.start_dt, sl.end_dt, w["start"], w["end"])
                if secs > 0:
                    agg[sl.user_id][w["idx"]] += secs

        month_rows = []
        for u in users:
            by_we = {idx: round(secs / 3600, 2) for idx, secs in agg.get(u.id, {}).items()}
            total_h = round(sum(agg.get(u.id, {}).values()) / 3600, 2)
            month_rows.append({
                "username": u.username,
                "by_we": by_we,
                "total_h": total_h,
            })

        # tri par total décroissant
        month_rows.sort(key=lambda r: r["total_h"], reverse=True)

        return render_template(
            "admin_volume_horaire.html",
            mode="month",
            month_start=month_start,
            weekend_windows=weekend_windows,
            month_rows=month_rows,
        )

    # --- Mode "Week-end" (détail) ---
    selected = request.args.get("date")
    anchor_date = datetime.strptime(selected, "%Y-%m-%d").date() if selected else datetime.now().date()

    sat_date, w_start, w_end = weekend_window(anchor_date)

    slots = TimeSlot.query.filter(TimeSlot.start_dt < w_end, TimeSlot.end_dt > w_start).all()

    agg = {}  # {uid: {"disponible": secs, "indisponible": secs}}
    for sl in slots:
        secs = overlap_seconds(sl.start_dt, sl.end_dt, w_start, w_end)
        if secs <= 0:
            continue

        agg.setdefault(sl.user_id, {"disponible": 0, "indisponible": 0})

        # On ne distingue plus "astreinte" côté admin : on la compte comme "disponible"
        st = sl.status
        if st == "astreinte":
            st = "disponible"

        key = st if st in ("disponible", "indisponible") else "indisponible"
        agg[sl.user_id][key] += secs

    users = User.query.order_by(User.username.asc()).all()

    rows = []
    for u in users:
        d = agg.get(u.id, {"disponible": 0, "indisponible": 0})
        disp_h = round(d["disponible"] / 3600, 2)
        indis_h = round(d["indisponible"] / 3600, 2)
        total_h = round((d["disponible"] + d["indisponible"]) / 3600, 2)

        rows.append({
            "username": u.username,
            "role": u.role,
            "disponible_h": disp_h,
            "indisponible_h": indis_h,
            "total_h": total_h,
        })

    rows.sort(key=lambda x: x["disponible_h"], reverse=True)

    return render_template(
        "admin_volume_horaire.html",
        mode="weekend",
        anchor_date=anchor_date,
        weekend_saturday=sat_date,
        window_start=w_start,
        window_end=w_end,
        rows=rows,
    )

@app.route("/synthese", methods=["GET"])
@login_required
def agent_synthese():
    """Synthèse hebdo (agent) : uniquement les créneaux du compte connecté."""
    if current_user.role == "admin":
        return redirect(url_for("admin_synthese"))

    selected = request.args.get("date")
    selected_date = datetime.strptime(selected, "%Y-%m-%d").date() if selected else datetime.now().date()

    week_monday = selected_date - timedelta(days=selected_date.weekday())
    week_start = datetime.combine(week_monday, time(7, 0))
    week_end = week_start + timedelta(days=7)

    window_seconds = 24 * 60 * 60

    slots = (
        TimeSlot.query
        .filter(TimeSlot.user_id == current_user.id)
        .filter(TimeSlot.start_dt < week_end, TimeSlot.end_dt > week_start)
        .all()
    )

    def status_class(st):
        if st == "disponible":
            return "bg-success"
        if st == "astreinte":
            return "bg-warning"
        return "bg-secondary"

    days = []
    for i in range(7):
        day_date = week_monday + timedelta(days=i)
        day_start = datetime.combine(day_date, time(7, 0))
        day_end = day_start + timedelta(days=1)

        day_slots = [sl for sl in slots if sl.start_dt < day_end and sl.end_dt > day_start]
        day_segments = []
        for sl in day_slots:
            s = max(sl.start_dt, day_start)
            e = min(sl.end_dt, day_end)
            if e <= s:
                continue
            left = (s - day_start).total_seconds() / window_seconds * 100.0
            width = (e - s).total_seconds() / window_seconds * 100.0
            title = f"{s.strftime('%H:%M')} → {e.strftime('%H:%M')} ({sl.status})"
            day_segments.append({
                "left": left,
                "width": width,
                "cls": status_class(sl.status),
                "title": title,
            })
        day_segments.sort(key=lambda x: x["left"])

        merged = merge_slots_into_ranges(day_slots, window_start=day_start, window_end=day_end)
        ranges = []
        for r in merged:
            ranges.append({
                "start_hm": r["start_dt"].strftime("%H:%M"),
                "end_hm": r["end_dt"].strftime("%H:%M"),
                "status": r["status"],
            })

        days.append({
            "date": day_date,
            "segments": day_segments,
            "ranges": ranges,
        })

    return render_template(
        "agent_synthese.html",
        selected_date=selected_date,
        week_monday=week_monday,
        week_start=week_start,
        week_end=week_end,
        days=days,
        timedelta=timedelta,
    )




# ----------------------------
# Manoeuvre Mensuel - Admin
# ----------------------------
@app.route("/admin/manoeuvre-mensuel", methods=["GET", "POST"])
@login_required
def admin_manoeuvre_mensuel():
    if current_user.role != "admin":
        flash("Accès réservé aux administrateurs.")
        return redirect(url_for("dashboard"))

    if request.method == "POST":
        titre = request.form.get("titre", "").strip()
        date_str = request.form.get("date_manoeuvre", "").strip()
        desc_suap = request.form.get("desc_suap", "").strip()
        desc_incdv = request.form.get("desc_incdv", "").strip()

        urls = request.form.getlist("ressource_url[]")
        labels = request.form.getlist("ressource_label[]")

        if not titre or not date_str:
            flash("Veuillez renseigner au minimum un titre et une date.")
            return redirect(url_for("admin_manoeuvre_mensuel"))

        date_manoeuvre = parse_date(date_str)

        manoeuvre = ManoeuvreMensuelle(
            titre=titre,
            date_manoeuvre=date_manoeuvre,
            desc_suap=desc_suap,
            desc_incdv=desc_incdv,
            created_by=current_user.id,
        )
        db.session.add(manoeuvre)
        db.session.flush()  # pour avoir l'id

        for i, url in enumerate(urls):
            url = (url or "").strip()
            if not url:
                continue
            label = (labels[i] if i < len(labels) else "") or ""
            db.session.add(ManoeuvreRessource(manoeuvre_id=manoeuvre.id, label=label.strip(), url=url))

        db.session.commit()

        # Notifications (email si configuré)
        notify_agents_manoeuvre_created(manoeuvre)

        flash("Manoeuvre mensuelle enregistrée.")
        return redirect(url_for("admin_manoeuvre_mensuel"))

    manoeuvres = ManoeuvreMensuelle.query.order_by(ManoeuvreMensuelle.date_manoeuvre.desc()).all()
    total_agents = User.query.filter_by(role="agent").count()

    # Pré-calcul : nb inscrits + présents/absents
    stats = {}
    for m in manoeuvres:
        presents = sum(1 for ins in m.inscriptions if ins.statut == "PRESENT")
        absents = sum(1 for ins in m.inscriptions if ins.statut == "ABSENT")
        stats[m.id] = {"total": len(m.inscriptions), "presents": presents, "absents": absents}

    return render_template(
        "admin_manoeuvre_mensuel.html",
        manoeuvres=manoeuvres,
        stats=stats,
        total_agents=total_agents,
    )


@app.route("/admin/manoeuvre-mensuel/<int:manoeuvre_id>")
@login_required
def admin_manoeuvre_detail(manoeuvre_id):
    if current_user.role != "admin":
        flash("Accès réservé aux administrateurs.")
        return redirect(url_for("dashboard"))

    manoeuvre = ManoeuvreMensuelle.query.get_or_404(manoeuvre_id)
    inscriptions = ManoeuvreInscription.query.filter_by(manoeuvre_id=manoeuvre_id).order_by(
        ManoeuvreInscription.nom.asc(), ManoeuvreInscription.prenom.asc()
    ).all()

    return render_template("admin_manoeuvre_detail.html", manoeuvre=manoeuvre, inscriptions=inscriptions)


@app.route("/admin/manoeuvre-mensuel/<int:manoeuvre_id>/edit", methods=["GET", "POST"])
@login_required
def admin_manoeuvre_edit(manoeuvre_id: int):
    if current_user.role != "admin":
        flash("Accès réservé aux administrateurs.")
        return redirect(url_for("dashboard"))

    manoeuvre = ManoeuvreMensuelle.query.get_or_404(manoeuvre_id)

    if request.method == "POST":
        titre = (request.form.get("titre") or "").strip()
        date_str = (request.form.get("date_manoeuvre") or "").strip()
        desc_suap = (request.form.get("desc_suap") or "").strip()
        desc_incdv = (request.form.get("desc_incdv") or "").strip()

        urls = request.form.getlist("ressource_url[]")
        labels = request.form.getlist("ressource_label[]")

        if not titre or not date_str:
            flash("Veuillez renseigner au minimum un titre et une date.")
            return redirect(url_for("admin_manoeuvre_edit", manoeuvre_id=manoeuvre_id))

        manoeuvre.titre = titre
        manoeuvre.date_manoeuvre = parse_date(date_str)
        manoeuvre.desc_suap = desc_suap
        manoeuvre.desc_incdv = desc_incdv

        # Remplace les ressources : on supprime puis on recrée
        ManoeuvreRessource.query.filter_by(manoeuvre_id=manoeuvre.id).delete(synchronize_session=False)
        for i, url in enumerate(urls):
            url = (url or "").strip()
            if not url:
                continue
            label = (labels[i] if i < len(labels) else "") or ""
            db.session.add(ManoeuvreRessource(manoeuvre_id=manoeuvre.id, label=label.strip(), url=url))

        db.session.commit()

        notify_agents_manoeuvre_updated(manoeuvre)
        flash("Manoeuvre mise à jour.")
        return redirect(url_for("admin_manoeuvre_detail", manoeuvre_id=manoeuvre.id))

    return render_template("admin_manoeuvre_edit.html", manoeuvre=manoeuvre)


@app.route("/admin/manoeuvre-mensuel/<int:manoeuvre_id>/delete", methods=["POST"])
@login_required
def admin_manoeuvre_delete(manoeuvre_id: int):
    if current_user.role != "admin":
        return "Accès interdit", 403

    manoeuvre = ManoeuvreMensuelle.query.get_or_404(manoeuvre_id)
    db.session.delete(manoeuvre)
    db.session.commit()
    flash("Manoeuvre supprimée.")
    return redirect(url_for("admin_manoeuvre_mensuel"))


@app.route("/admin/manoeuvre-mensuel/agent/<int:user_id>")
@login_required
def admin_manoeuvre_agent_history(user_id):
    if current_user.role != "admin":
        flash("Accès réservé aux administrateurs.")
        return redirect(url_for("dashboard"))

    agent = User.query.get_or_404(user_id)
    if agent.role != "agent":
        flash("Historique disponible uniquement pour les agents.")
        return redirect(url_for("admin_agents"))

    manoeuvres = ManoeuvreMensuelle.query.order_by(ManoeuvreMensuelle.date_manoeuvre.desc()).all()
    inscriptions = ManoeuvreInscription.query.filter_by(user_id=agent.id).all()
    ins_by_m = {i.manoeuvre_id: i for i in inscriptions}

    rows = []
    for m in manoeuvres:
        ins = ins_by_m.get(m.id)
        rows.append({
            "manoeuvre": m,
            "statut": (ins.statut if ins else "NON_INSCRIT"),
            "created_at": (ins.created_at if ins else None),
        })

    return render_template("admin_manoeuvre_agent_history.html", agent=agent, rows=rows)


@app.route("/admin/manoeuvre-mensuel/<int:manoeuvre_id>/export.csv")
@login_required
def admin_manoeuvre_export_csv(manoeuvre_id):
    if current_user.role != "admin":
        return "Accès interdit", 403

    manoeuvre = ManoeuvreMensuelle.query.get_or_404(manoeuvre_id)
    inscriptions = ManoeuvreInscription.query.filter_by(manoeuvre_id=manoeuvre_id).order_by(
        ManoeuvreInscription.nom.asc(), ManoeuvreInscription.prenom.asc()
    ).all()

    lines = ["Nom;Prénom;Statut;Date inscription"]
    for ins in inscriptions:
        lines.append(
            f"{ins.nom};{ins.prenom};{ins.statut};{ins.created_at.strftime('%d/%m/%Y %H:%M')}"
        )

    filename = f"manoeuvre_{manoeuvre_id}_{manoeuvre.date_manoeuvre.strftime('%Y%m%d')}.csv"
    csv_data = "\n".join(lines)
    return Response(
        csv_data,
        mimetype="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ----------------------------
# Manoeuvre Mensuel - Agent
# ----------------------------
@app.route("/manoeuvre-mensuel", methods=["GET", "POST"])
@login_required
def manoeuvre_mensuel():
    manoeuvre = get_latest_manoeuvre_for_user()

    if manoeuvre is None:
        if current_user.role == "admin":
            flash("Aucune manoeuvre créée. Créez-en une dans l'espace admin.")
        else:
            flash("Aucune manoeuvre mensuelle disponible pour le moment.")
        return render_template(
            "manoeuvre_mensuel.html",
            manoeuvre=None,
            inscription=None,
            is_closed=False,
            profile_incomplete=True,
        )

    # Marque comme "vue" pour notification dashboard
    session["seen_manoeuvre_id"] = manoeuvre.id

    existing = ManoeuvreInscription.query.filter_by(manoeuvre_id=manoeuvre.id, user_id=current_user.id).first()

    today = datetime.now().date()
    is_closed = manoeuvre.date_manoeuvre < today

    if request.method == "POST":
        if is_closed:
            flash("Les inscriptions sont clôturées pour cette manoeuvre.")
            return redirect(url_for("manoeuvre_mensuel"))

        nom = (current_user.nom or "").strip()
        prenom = (current_user.prenom or "").strip()
        statut = request.form.get("statut", "PRESENT").strip().upper()

        if statut not in ("PRESENT", "ABSENT"):
            statut = "PRESENT"

        if not nom or not prenom:
            flash("Veuillez renseigner votre nom/prénom dans votre profil avant de vous inscrire.")
            return redirect(url_for("profil"))

        if existing:
            existing.nom = nom
            existing.prenom = prenom
            existing.statut = statut
        else:
            db.session.add(
                ManoeuvreInscription(
                    manoeuvre_id=manoeuvre.id,
                    user_id=current_user.id,
                    nom=nom,
                    prenom=prenom,
                    statut=statut,
                )
            )
        db.session.commit()
        flash("Inscription enregistrée.")
        return redirect(url_for("manoeuvre_mensuel"))

    return render_template(
        "manoeuvre_mensuel.html",
        manoeuvre=manoeuvre,
        inscription=existing,
        is_closed=is_closed,
        profile_incomplete=(not (current_user.nom or "").strip()) or (not (current_user.prenom or "").strip()),
    )



@app.route("/change-password", methods=["GET", "POST"])
@login_required
def change_password():
    if request.method == "POST":
        new_password = request.form["password"]

        current_user.password = generate_password_hash(new_password, method="pbkdf2:sha256")
        current_user.must_change_password = False
        db.session.commit()

        flash("Mot de passe mis à jour !")
        return redirect(url_for("dashboard"))

    return render_template("change_password.html")


@app.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for("login"))


# ----------------------------
# Initialisation DB + admin
# ----------------------------
with app.app_context():
    db.create_all()
    _ensure_user_profile_columns()
    if not User.query.filter_by(username="admin").first():
        admin = User(
            username="admin",
            password=generate_password_hash("admin123", method="pbkdf2:sha256"),
            role="admin",
            must_change_password=False,
        )
        db.session.add(admin)
        db.session.commit()


if __name__ == "__main__":
    app.run(debug=True)
