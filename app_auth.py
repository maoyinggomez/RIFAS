from datetime import datetime
import os
import re
import secrets
from urllib.parse import urlparse

from authlib.integrations.flask_client import OAuth
from dotenv import load_dotenv
from flask import Flask, jsonify, redirect, render_template, request, session, url_for
from flask_login import (
    LoginManager,
    UserMixin,
    current_user,
    login_required,
    login_user,
    logout_user,
)
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import inspect, text
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.middleware.proxy_fix import ProxyFix

load_dotenv()

IS_PRODUCTION = bool(os.getenv("RENDER") or os.getenv("FLASK_ENV") == "production" or os.getenv("ENVIRONMENT") == "production")

raw_secret = (os.getenv("SECRET_KEY") or os.getenv("FLASK_SECRET_KEY") or "").strip()
secret_key = raw_secret if len(raw_secret) > 0 else "rifa-super-secret-key-render-production-2026-xyz"

app = Flask(__name__, static_folder=".", static_url_path="")
app.secret_key = secret_key
app.config["SECRET_KEY"] = secret_key

database_url = os.getenv("DATABASE_URL", "sqlite:///rifa.db")
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

app.config["SQLALCHEMY_DATABASE_URI"] = database_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

# Soporte para proxy inverso de Render (HTTPS)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_port=1, x_prefix=1)

if IS_PRODUCTION:
    app.config["SESSION_COOKIE_SECURE"] = True
    app.config["PREFERRED_URL_SCHEME"] = "https"

db = SQLAlchemy(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = "login_page"

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip().strip("'\"")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "").strip().strip("'\"")
GOOGLE_OAUTH_READY = bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)

oauth = OAuth(app)
google = None
if GOOGLE_OAUTH_READY:
    google = oauth.register(
        name="google",
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )


class User(UserMixin, db.Model):
    __tablename__ = "user"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    google_id = db.Column(db.String(255), unique=True, nullable=True)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_admin = db.Column(db.Boolean, default=False)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


def normalize_username(value):
    cleaned = re.sub(r"[^a-zA-Z0-9._-]+", "", value or "").strip("._-")
    return cleaned[:80] or "usuario"


def build_unique_username(base):
    candidate = normalize_username(base)
    original = candidate
    suffix = 1

    while User.query.filter_by(username=candidate).first():
        suffix_text = f"-{suffix}"
        candidate = f"{original[:80 - len(suffix_text)]}{suffix_text}"
        suffix += 1

    return candidate


def is_safe_next_url(target):
    if not target:
        return False

    parsed = urlparse(target)
    return parsed.scheme == "" and parsed.netloc == "" and target.startswith("/")


def oauth_error_response(error_code, details=""):
    message = {
        "google_not_configured": "Google OAuth no está configurado en el servidor.",
        "google_oauth_failed": "Google OAuth falló durante la autenticación.",
    }.get(error_code, "Error de autenticación con Google.")

    payload = {"error": error_code, "message": message}
    if details:
        payload["details"] = details
    return jsonify(payload), 500


def sync_user_schema():
    inspector = inspect(db.engine)
    tables = inspector.get_table_names()
    if "user" not in tables:
        return

    columns = {column["name"] for column in inspector.get_columns("user")}
    if "google_id" not in columns:
        with db.engine.begin() as connection:
            connection.execute(text('ALTER TABLE "user" ADD COLUMN google_id VARCHAR(255)'))

    with db.engine.begin() as connection:
        connection.execute(
            text('CREATE UNIQUE INDEX IF NOT EXISTS ix_user_google_id ON "user" (google_id)')
        )


def find_or_create_google_user(profile):
    email = (profile.get("email") or "").strip().lower()
    google_id = (profile.get("sub") or "").strip()
    display_name = (profile.get("name") or profile.get("given_name") or "").strip()

    if not email or not google_id:
        return None

    user = User.query.filter_by(google_id=google_id).first()
    if user:
        if user.email != email:
            user.email = email
        return user

    user = User.query.filter_by(email=email).first()
    if user:
        user.google_id = google_id
        return user

    username_base = display_name or email.split("@", 1)[0] or f"google-{google_id[:8]}"
    user = User(
        username=build_unique_username(username_base),
        email=email,
        google_id=google_id,
    )
    user.set_password(secrets.token_urlsafe(32))
    db.session.add(user)
    return user


@app.route("/auth/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    username = data.get("username", "").strip()
    email = data.get("email", "").strip()
    password = data.get("password", "")
    confirm_password = data.get("confirm_password", "")

    if not username or not email or not password:
        return jsonify({"error": "Todos los campos son requeridos"}), 400

    if len(password) < 6:
        return jsonify({"error": "La contraseña debe tener al menos 6 caracteres"}), 400

    if password != confirm_password:
        return jsonify({"error": "Las contraseñas no coinciden"}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"error": "El usuario ya existe"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "El email ya está registrado"}), 400

    user = User(username=username, email=email)
    user.set_password(password)

    db.session.add(user)
    db.session.commit()

    return jsonify({"message": "Usuario registrado exitosamente"}), 201


@app.route("/auth/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"error": "Usuario y contraseña requeridos"}), 400

    user = User.query.filter_by(username=username).first()

    if user and user.check_password(password):
        login_user(user)
        return (
            jsonify(
                {
                    "message": "Login exitoso",
                    "user": {
                        "id": user.id,
                        "username": user.username,
                        "email": user.email,
                        "is_admin": user.is_admin,
                    },
                }
            ),
            200,
        )

    return jsonify({"error": "Usuario o contraseña incorrectos"}), 401


@app.route("/auth/google/login")
def google_login():
    if not GOOGLE_OAUTH_READY or google is None:
        return redirect(url_for("login_page", error="google_not_configured"))

    next_url = request.args.get("next")
    if is_safe_next_url(next_url):
        session["google_login_next"] = next_url

    try:
        scheme = "https" if (request.is_secure or request.headers.get("X-Forwarded-Proto") == "https" or IS_PRODUCTION) else "http"
        redirect_uri = url_for("google_callback", _external=True, _scheme=scheme)
        return google.authorize_redirect(redirect_uri)
    except Exception as exc:
        app.logger.exception("Google OAuth login failed")
        return oauth_error_response("google_oauth_failed", str(exc))


@app.route("/auth/google/callback")
def google_callback():
    if not GOOGLE_OAUTH_READY or google is None:
        return redirect(url_for("login_page", error="google_not_configured"))

    if request.args.get("error"):
        error_msg = request.args.get("error_description") or request.args.get("error")
        return redirect(url_for("login_page", error=error_msg))

    try:
        token = google.authorize_access_token()
        profile = None

        if isinstance(token, dict) and "userinfo" in token:
            profile = token["userinfo"]

        if not profile:
            try:
                profile = google.parse_id_token(token)
            except Exception:
                pass

        if not profile:
            try:
                resp = google.get("https://openidconnect.googleapis.com/v1/userinfo")
                if resp.ok:
                    profile = resp.json()
            except Exception:
                pass

        if not profile:
            return redirect(url_for("login_page", error="google_profile_incomplete"))

        user = find_or_create_google_user(profile)
        if not user:
            return redirect(url_for("login_page", error="google_profile_incomplete"))

        db.session.commit()
        login_user(user)
        next_url = session.pop("google_login_next", None)
        if not is_safe_next_url(next_url):
            next_url = None
        return redirect(next_url or url_for("dashboard"))

    except Exception as exc:
        db.session.rollback()
        app.logger.exception("Google OAuth callback failed")
        return oauth_error_response("google_oauth_failed", str(exc))


@app.route("/auth/logout", methods=["POST"])
@login_required
def logout():
    logout_user()
    return jsonify({"message": "Sesión cerrada"}), 200


@app.route("/auth/me", methods=["GET"])
@login_required
def get_current_user():
    return (
        jsonify(
            {
                "id": current_user.id,
                "username": current_user.username,
                "email": current_user.email,
                "is_admin": current_user.is_admin,
            }
        ),
        200,
    )


@app.route("/")
def index():
    if current_user.is_authenticated:
        return redirect(url_for("dashboard"))
    return redirect(url_for("login_page"))


@app.route("/login")
def login_page():
    if current_user.is_authenticated:
        return redirect(url_for("dashboard"))

    login_error = request.args.get("error", "")
    next_url = request.args.get("next", "")
    return render_template(
        "login.html",
        google_login_enabled=GOOGLE_OAUTH_READY,
        login_error=login_error,
        next_url=next_url,
    )


@app.route("/register")
def register_page():
    if current_user.is_authenticated:
        return redirect(url_for("dashboard"))
    return render_template("register.html")


@app.route("/dashboard")
@login_required
def dashboard():
    return render_template("index.html")


with app.app_context():
    db.create_all()
    sync_user_schema()

    if not User.query.filter_by(username="admin").first():
        admin = User(username="admin", email="admin@rifa.local", is_admin=True)
        admin.set_password("admin123")
        db.session.add(admin)
        db.session.commit()
        print("✅ Usuario admin creado: admin / admin123")

    if not GOOGLE_OAUTH_READY:
        print("⚠️ Google OAuth no está configurado. Define GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET.")


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=8080)
