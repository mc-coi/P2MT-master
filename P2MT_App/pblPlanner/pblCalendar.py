from flask_login import current_user
from P2MT_App import db
from P2MT_App.main.utilityfunctions import printLogEntry
from P2MT_App.googleAPI.googleCalendar import (
    addSingleCalendarEvent,
    updateSingleCalendarEvent,
    deleteCalendarEvent,
)


def addPblEventToCalendar(
    googleCalendarEventID,
    eventCategory,
    pblName,
    eventDate,
    eventLocation,
    eventStreetAddress,
    eventCity,
    eventState,
    eventZip,
    startTime,
    endTime,
    pblSponsor,
):
    # Add PBL event to calendar
    printLogEntry("Running addPblEventToCalendar()")

    eventName = f"{eventCategory}: {pblName}"
    location = (
        f"{eventLocation}, {eventStreetAddress}, {eventCity}, {eventState} {eventZip}"
    )
    description = pblSponsor
    # Use Google Calendar ID for phase2team@students.hcde.org / _STEM III PBL Events
    googleCalendarID = "c_f341iehphlf687fda2m4a7t0f0@group.calendar.google.com"
    if googleCalendarEventID:
        print("update calendar event")
    # Include email addresses for attendees if desired
    attendees = ["Calendar_STEM@hcde.org"]
    # Add the event to the Google Calendar:
    #   If googleCalendarEventID exists, try updating the existing calendar event
    #   If the existing event cannot be found, add a new one
    #   If there is no existing event, add a new one
    if googleCalendarEventID:
        try:
            googleCalendarEventID = updateSingleCalendarEvent(
                googleCalendarID,
                googleCalendarEventID,
                eventName,
                location,
                eventDate,
                startTime,
                endTime,
                description,
                attendees,
            )
            print("Updated existing calendar event.")
        except:
            googleCalendarEventID = addSingleCalendarEvent(
                googleCalendarID,
                eventName,
                location,
                eventDate,
                startTime,
                endTime,
                description,
                attendees,
            )
            print("Unable to find existing calendar event.  Created new event.")
    else:
        googleCalendarEventID = addSingleCalendarEvent(
            googleCalendarID,
            eventName,
            location,
            eventDate,
            startTime,
            endTime,
            description,
            attendees,
        )
        print("Event added to Google Calendar")
    return googleCalendarEventID


def deletePblEventFromCalendar(googleCalendarEventID):
    printLogEntry("Running deletePblEventFromCalendar()")
    # Use Google Calendar ID for phase2team@students.hcde.org / _STEM III PBL Events
    googleCalendarID = "c_f341iehphlf687fda2m4a7t0f0@group.calendar.google.com"
    try:
        deleteCalendarEvent(googleCalendarID, googleCalendarEventID)
        print("Deleted event from the calendar")
    except:
        print("Unable to find event to delete from the calendar")
    return
