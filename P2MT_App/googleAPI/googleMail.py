# Stuff for Google Mail functions

from __future__ import print_function
from googleapiclient.discovery import build
from apiclient import errors
from httplib2 import Http
from email.mime.text import MIMEText
import base64
from google.oauth2 import service_account
from P2MT_App.main.referenceData import (
    getSystemAccountEmail,
    getEmailModeStatus,
    getApiKey,
)
from P2MT_App.main.utilityfunctions import printLogEntry
from flask import flash
from flask_login import current_user
import json

import os

AZURE_SEND_EMAIL_URL = os.getenv("AZURE_SEND_EMAIL_URL")

import requests
from icecream import ic

# Email variables. Modify this!
EMAIL_FROM = "phase2team@students.hcde.org"
EMAIL_TO = "phase2team@students.hcde.org"
EMAIL_SUBJECT = "STEM Intervention"
EMAIL_CONTENT = "STEM Intervention Email Content"


def create_message(sender, to, cc, bcc, subject, message_text):
    """Create a message for an email.
  Args:
    sender: Email address of the sender.
    to: Email address of the receiver.
    subject: The subject of the email message.
    message_text: The text of the email message.
  Returns:
    An object containing a base64url encoded email object.
  """
    message = MIMEText(message_text, "html")
    message["reply-to"] = cc
    message["to"] = to
    message["cc"] = cc
    message["bcc"] = bcc
    message["from"] = sender
    message["subject"] = subject
    raw = base64.urlsafe_b64encode(message.as_bytes())
    raw = raw.decode()
    body = {"raw": raw}
    return {"raw": raw}


def send_message(service, user_id, message):
    """Send an email message.
  Args:
    service: Authorized Gmail API service instance.
    user_id: User's email address. The special value "me"
    can be used to indicate the authenticated user.
    message: Message to be sent.
  Returns:
    Sent Message.
  """
    printLogEntry("Running send_message()")
    try:
        message = (
            service.users().messages().send(userId=user_id, body=message).execute()
        )
        print("Message Id: %s" % message["id"])
        return message
    except:
        print("Error occurred")
        # except errors.HttpError as error:
        print("An error occurred: %s" % errors)
        print("error code: ", errors.HttpError)
    return


def service_account_login():
    printLogEntry("Running service_account_login()")
    SCOPES = ["https://www.googleapis.com/auth/gmail.send"]
    # SERVICE_ACCOUNT_FILE = "google_credentials/verdant-root-256217-566d3ff37798.json"
    # credentials = service_account.Credentials.from_service_account_file(
    #     SERVICE_ACCOUNT_FILE, scopes=SCOPES
    # )
    SERVICE_ACCOUNT_INFO = json.loads(getApiKey())
    credentials = service_account.Credentials.from_service_account_info(
        SERVICE_ACCOUNT_INFO, scopes=SCOPES
    )

    # print(
    #     "credentials.project_id =", credentials.project_id,
    # )
    # print(
    #     "credentials._service_account_email =", credentials._service_account_email,
    # )
    # print(
    #     "credentials.scopes =", credentials.scopes,
    # )
    # print(
    #     "credentials.expired =", credentials.expired,
    # )
    # print(
    #     "credentials.valid =", credentials.valid,
    # )
    delegated_credentials = credentials.with_subject("phase2team@students.hcde.org")
    # delegated_credentials = credentials.with_subject("mccoy_z@hcde.org")
    # print(
    #     "delegated_credentials.project_id =", delegated_credentials.project_id,
    # )
    # print(
    #     "delegated_credentials._service_account_email =",
    #     delegated_credentials._service_account_email,
    # )
    # print(
    #     "delegated_credentials.scopes =", delegated_credentials.scopes,
    # )
    # print(
    #     "delegated_credentials.expired =", delegated_credentials.expired,
    # )
    # print(
    #     "delegated_credentials.valid =", delegated_credentials.valid,
    # )

    service = build("gmail", "v1", credentials=delegated_credentials)
    return service


def send_azure_email(
    email_sender, email_to, email_cc, email_bcc, emailSubject, emailContent
):
    """Send email using Azure."""
    printLogEntry("Running send_azure_email()")
    url = AZURE_SEND_EMAIL_URL
    print("email_sender = ", email_sender)
    data = {
        "sender": email_sender,
        "recipient": email_to,
        "email_cc": email_cc,
        "email_bcc": email_bcc,
        "subject": emailSubject,
        "html_message": emailContent,
        "text_message": emailContent,
    }
    # headers = {"content-type": "application/json"}
    r = requests.post(url, json=data)
    printLogEntry("Executed request to 'Azure Send Email'")
    print("request status code =", r.status_code)
    try:
        print("request response =", r.json())
    except:
        print("request response =", r)
    if r.status_code == 200 or r.status_code == 202:
        return True
    else:
        return False


def sendEmail(email_to, email_cc, emailSubject, emailContent):
    printLogEntry("Running sendEmail()")
    # include the system account as a bcc recipient on all emails
    email_bcc = getSystemAccountEmail()
    # if the email recipient is a list, then use commas to seperate the email addresses
    if isinstance(email_to, list):
        email_to = ",".join(email_to)
    # Retrieve current system mode
    SystemMode = getEmailModeStatus()
    if SystemMode == False:
        print("System Mode = Test. Sending email to", current_user.email)
        email_to = current_user.email
        email_cc = current_user.email
    email_details = f"Email Details - to: {email_to} cc: {email_cc} bcc: {email_bcc} subject: {emailSubject}"
    print(email_details)
    use_azure_send_email = os.getenv("USE_AZURE_SEND_EMAIL", "False").lower() in [
        "true",
        "1",
    ]
    if use_azure_send_email:
        email_sender = current_user.email
        sent = send_azure_email(
            email_sender, email_to, email_cc, email_bcc, emailSubject, emailContent
        )
    else:
        email_sender = "phase2team@students.hcde.org"
        message = create_message(
            email_sender, email_to, email_cc, email_bcc, emailSubject, emailContent
        )
        # print("message =", message)
        service = service_account_login()
        print("service =", service)
        sent = send_message(service, "phase2team@students.hcde.org", message)
    print("sent message =", sent)
    if sent is None or sent == False:
        flash_message = f"Error: Unable to send email.  Review {email_details}"
        flash(flash_message, "error")
    else:
        flash("Email notification has been sent!", "success")
    return

