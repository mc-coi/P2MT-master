# Google Calendar API stuff
import datetime
from P2MT_App.main.referenceData import findEarliestPhaseIIDayNoEarlierThan, getApiKey
from P2MT_App.main.utilityfunctions import printLogEntry
import json
from googleapiclient.discovery import build
from google.oauth2 import service_account


def service_account_calendar_login():
    printLogEntry("Running service_account_calendar_login()")
    SCOPES = ["https://www.googleapis.com/auth/calendar"]
    SERVICE_ACCOUNT_INFO = json.loads(getApiKey())
    credentials = service_account.Credentials.from_service_account_info(
        SERVICE_ACCOUNT_INFO, scopes=SCOPES
    )
    delegated_credentials = credentials.with_subject("phase2team@students.hcde.org")
    service = build("calendar", "v3", credentials=delegated_credentials)
    return service


def addCalendarEvent(
    googleCalendarID,
    eventName,
    location,
    classDays,
    startDate,
    endDate,
    startTime,
    endTime,
    recurrence,
):
    printLogEntry("Running addCalendarEvent()")
    print("classDays =", classDays)
    print("startDate =", startDate)

    # Find the earliest Phase II school day to use as the starting date for the event series
    # Example: if the start date is Monday, Sep 7th and classDays='TR', earliest date will be Tuesday, Sep 8th
    earliestDate = []
    for day in classDays:
        earliestDate.append(findEarliestPhaseIIDayNoEarlierThan(startDate, day))
    earliestDate.sort()
    print("earliestDates sorted =", earliestDate)
    startDate = earliestDate[0]

    # Combine dates and times required for calendar event
    startDateTime = datetime.datetime.combine(startDate, startTime)
    endDateTime = datetime.datetime.combine(startDate, endTime)
    endRecurrence = datetime.datetime.combine(endDate, datetime.time(23, 59, 59))

    # Create BYDAY parameter to specify the days for the recurring event
    byDayList = []
    for day in classDays:
        if day == "M":
            byDayList.append("MO")
        if day == "T":
            byDayList.append("TU")
        if day == "W":
            byDayList.append("WE")
        if day == "R":
            byDayList.append("TH")
        if day == "F":
            byDayList.append("FR")
    byDay = ",".join(byDayList)

    # Create the event following the Google Calendar API
    # https://developers.google.com/calendar/v3/reference/events/insert
    # Recurrence rule per RFC 5545 https://tools.ietf.org/html/rfc5545#section-3.8.5
    event = {
        "summary": eventName,
        "location": location,
        "description": "",
        "start": {
            "dateTime": startDateTime.isoformat(),
            "timeZone": "America/New_York",
        },
        "end": {"dateTime": endDateTime.isoformat(), "timeZone": "America/New_York",},
        "recurrence": [
            "RRULE:FREQ=WEEKLY;UNTIL="
            + endRecurrence.isoformat().replace("-", "").replace(":", "")
            + "Z"
            + ";BYDAY="
            + byDay,
        ],
        # 'attendees': [
        #     {'email': 'lpage@example.com'},
        #     {'email': 'sbrin@example.com'},
        # ],
        "reminders": {
            "useDefault": False,
            # "overrides": [
            #     {"method": "email", "minutes": 24 * 60},
            #     {"method": "popup", "minutes": 10},
            # ],
        },
    }
    print("New calendar event details:", event)

    # Add code to send event to Google Calendar API service object
    # Return the googleCalendarEventID to be added to ClassSchedule table
    service = service_account_calendar_login()
    print("service =", service)
    calendarEventDetails = (
        service.events().insert(calendarId=googleCalendarID, body=event).execute()
    )
    googleCalendarEventID = calendarEventDetails["id"]
    print("googleCalendarEventID =", googleCalendarEventID)
    # googleCalendarEventID = "test"
    return googleCalendarEventID


def addSingleCalendarEvent(
    googleCalendarID,
    eventName,
    location,
    eventDate,
    startTime,
    endTime,
    description,
    attendees,
):
    printLogEntry("Running addSingleCalendarEvent()")
    print("eventDate =", eventDate)

    # Combine dates and times required for calendar event
    startDateTime = datetime.datetime.combine(eventDate, startTime)
    endDateTime = datetime.datetime.combine(eventDate, endTime)
    attendeesList = []
    for attendee in attendees:
        attendeesList.append({"email": attendee})

    event = {
        "summary": eventName,
        "location": location,
        "description": description,
        "start": {
            "dateTime": startDateTime.isoformat(),
            "timeZone": "America/New_York",
        },
        "end": {"dateTime": endDateTime.isoformat(), "timeZone": "America/New_York",},
        # "recurrence": [
        #     "RRULE:FREQ=WEEKLY;UNTIL="
        #     + endRecurrence.isoformat().replace("-", "").replace(":", "")
        #     + "Z"
        #     + ";BYDAY="
        #     + byDay,
        # ],
        "attendees": attendeesList,
        # "reminders": {
        #     "useDefault": False,
        #     "overrides": [
        #         {"method": "email", "minutes": 24 * 60},
        #         {"method": "popup", "minutes": 10},
        #     ],
        # },
    }
    print("New calendar event details:", event)

    # Add code to send event to Google Calendar API service object
    # Return the googleCalendarEventID to be added to ClassSchedule table
    service = service_account_calendar_login()
    print("service =", service)
    calendarEventDetails = (
        service.events().insert(calendarId=googleCalendarID, body=event).execute()
    )
    googleCalendarEventID = calendarEventDetails["id"]
    print("googleCalendarEventID =", googleCalendarEventID)
    # googleCalendarEventID = "test"
    return googleCalendarEventID


def updateSingleCalendarEvent(
    googleCalendarID,
    googleCalendarEventID,
    eventName,
    location,
    eventDate,
    startTime,
    endTime,
    description,
    attendees,
):
    printLogEntry("Running updateSingleCalendarEvent()")
    print("eventDate =", eventDate)

    # Combine dates and times required for calendar event
    startDateTime = datetime.datetime.combine(eventDate, startTime)
    endDateTime = datetime.datetime.combine(eventDate, endTime)
    attendeesList = []
    for attendee in attendees:
        attendeesList.append({"email": attendee})

    event = {
        "summary": eventName,
        "location": location,
        "description": description,
        "start": {
            "dateTime": startDateTime.isoformat(),
            "timeZone": "America/New_York",
        },
        "end": {"dateTime": endDateTime.isoformat(), "timeZone": "America/New_York",},
        # "recurrence": [
        #     "RRULE:FREQ=WEEKLY;UNTIL="
        #     + endRecurrence.isoformat().replace("-", "").replace(":", "")
        #     + "Z"
        #     + ";BYDAY="
        #     + byDay,
        # ],
        "attendees": attendeesList,
        # "reminders": {
        #     "useDefault": False,
        #     "overrides": [
        #         {"method": "email", "minutes": 24 * 60},
        #         {"method": "popup", "minutes": 10},
        #     ],
        # },
    }
    print("Updated calendar event details:", event)

    # Add code to send event to Google Calendar API service object
    # Return the googleCalendarEventID to be added to ClassSchedule table
    service = service_account_calendar_login()
    print("service =", service)
    calendarEventDetails = (
        service.events()
        .update(calendarId=googleCalendarID, eventId=googleCalendarEventID, body=event)
        .execute()
    )
    googleCalendarEventID = calendarEventDetails["id"]
    print("googleCalendarEventID =", googleCalendarEventID)
    return googleCalendarEventID


def deleteCalendarEvent(googleCalendarID, googleCalendarEventID):
    printLogEntry("Running deleteCalendarEvent()")
    print(
        "googleCalendar =",
        googleCalendarID,
        "googleCalendarEventID =",
        googleCalendarEventID,
    )
    # Reference: https://developers.google.com/calendar/v3/reference/events/delete
    # Add code to create Google Calendar Service object
    service = service_account_calendar_login()
    print("service =", service)
    service.events().delete(
        calendarId=googleCalendarID, eventId=googleCalendarEventID
    ).execute()
    return
