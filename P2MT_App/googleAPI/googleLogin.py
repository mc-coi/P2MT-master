import requests

from P2MT_App.models import FacultyAndStaff

GOOGLE_DISCOVERY_URL = "https://accounts.google.com/.well-known/openid-configuration"

# Included for reference. AuthLib handles retrieval of authorization endpoint.
# See https://realpython.com/flask-google-login/
def get_google_provider_cfg():
    google_provider_cfg = requests.get(GOOGLE_DISCOVERY_URL).json()
    authorization_endpoint = google_provider_cfg["authorization_endpoint"]
    token_endpoint = google_provider_cfg["token_endpoint"]
    userinfo_endpoint = google_provider_cfg["userinfo_endpoint"]
    print("authorization_endpoint:", authorization_endpoint)
    print("token_endpoint:", token_endpoint)
    print("userinfo_endpoint:", userinfo_endpoint)
    return google_provider_cfg


def updateProfilePic(user_id, profilePicUrl):
    user = FacultyAndStaff.query.get(user_id)
    print("user_id =", user_id)
    print("user =", user)
    print("profilePicUrl =", profilePicUrl)
    user.google_picture = profilePicUrl
    return


def updateGoogleSub(user_id, googleSubId):
    user = FacultyAndStaff.query.get(user_id)
    user.google_sub = googleSubId
    return
