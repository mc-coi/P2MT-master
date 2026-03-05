from flask import Blueprint, render_template

errors_bp = Blueprint("errors_bp", __name__)

# Reference: Python Flask Tutorials: Tutorial 12: Custom Error Pages
# https://coreyms.com/development/python/python-flask-tutorials-full-series


@errors_bp.app_errorhandler(404)
def error_404(error):
    return render_template("errors/404.html", title="404 Error"), 404


@errors_bp.app_errorhandler(401)
def error_403(error):
    return render_template("errors/401.html", title="401 Error"), 401


@errors_bp.app_errorhandler(403)
def error_403(error):
    return render_template("errors/403.html", title="403 Error"), 403


@errors_bp.app_errorhandler(500)
def error_500(error):
    return render_template("errors/500.html", title="500 Error", error=error), 500
