import os
from os.path import join, dirname
from dotenv import load_dotenv

dotenv_path = join(dirname(__file__), "local.env")
load_dotenv(dotenv_path)


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY")
    # SQLALCHEMY_DATABASE_URI = "sqlite:///p2mt_tmi_notifications.db"
    SQLALCHEMY_DATABASE_URI = "sqlite:///p2mt_pbl_planner.db"
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Set environment variables necessary for Google login and API usage
    USE_GOOGLE_LOGIN_AND_API = "True"
    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
    WTF_CSRF_TIME_LIMIT = None
