from flask import send_file, current_app
from P2MT_App import db
from P2MT_App.models import PblEvents, Pbls, PblTeams, Student
from P2MT_App.main.utilityfunctions import download_File, printLogEntry
from P2MT_App.main.referenceData import getSchoolYearForQuarter
from datetime import datetime, date, time
import re
import os
import csv


def downloadPblEvents(quarter, eventCategory):
    printLogEntry("downloadPblEvents() function called")
    # Create a CSV output file and append with a timestamp
    output_file_path = os.path.join(current_app.root_path, "static/download")
    output_file_path = "/tmp"
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    csvFilename = output_file_path + "/" + "pbl_events_" + timestamp + ".csv"
    csvOutputFile = open(csvFilename, "w")
    csvOutputWriter = csv.writer(
        csvOutputFile, delimiter=",", quotechar='"', quoting=csv.QUOTE_MINIMAL
    )
    # Write header row for CSV file
    csvOutputWriter.writerow(
        [
            "Class",
            "School Year",
            "Semester",
            "Quarter",
            "PBL Name",
            "PBL Sponsor",
            "PBL Sponsor Person Name",
            "Event Category",
            "Confirmed",
            "Event Date",
            "Start Time",
            "End Time",
            "Event Location",
            "Event Street Address",
            "Event City",
            "Event State",
            "Event Zip",
            "Event Comments",
            "googleCalendarEventID",
        ]
    )
    csvOutputFileRowCount = 0
    # Query the PblEvents with a join to include student information
    pblEvents = (
        PblEvents.query.join(Pbls)
        .filter(
            Pbls.schoolYear == getSchoolYearForQuarter(quarter),
            Pbls.quarter == quarter,
            PblEvents.eventCategory == eventCategory,
        )
        .order_by(Pbls.quarter, PblEvents.eventDate, PblEvents.startTime, Pbls.pblName,)
    )
    # Process each record in the query and write to the output file
    for pblEvent in pblEvents:
        className = pblEvent.Pbls.className
        schoolYear = pblEvent.Pbls.schoolYear
        semester = pblEvent.Pbls.semester
        quarter = pblEvent.Pbls.quarter
        pblName = pblEvent.Pbls.pblName
        pblSponsor = pblEvent.Pbls.pblSponsor
        pblSponsorPersonName = pblEvent.Pbls.pblSponsorPersonName
        eventCategory = pblEvent.eventCategory
        confirmed = pblEvent.confirmed
        if pblEvent.eventDate:
            eventDate = pblEvent.eventDate
            startTime = pblEvent.startTime
            endTime = pblEvent.endTime
            eventDate = eventDate.strftime("%Y-%m-%d")
            startTime = startTime.strftime("%-I:%M %p")
            endTime = endTime.strftime("%-I:%M %p")
        else:
            eventDate = ""
            startTime = ""
            endTime = ""
        eventLocation = pblEvent.eventLocation
        eventStreetAddress1 = pblEvent.eventStreetAddress1
        eventCity = pblEvent.eventCity
        eventState = pblEvent.eventState
        eventZip = pblEvent.eventZip
        eventComments = pblEvent.eventComments
        googleCalendarEventID = pblEvent.googleCalendarEventID

        csvOutputWriter.writerow(
            [
                className,
                str(schoolYear),
                semester,
                str(quarter),
                pblName,
                pblSponsor,
                pblSponsorPersonName,
                eventCategory,
                confirmed,
                eventDate,
                startTime,
                endTime,
                eventLocation,
                eventStreetAddress1,
                eventCity,
                eventState,
                eventZip,
                eventComments,
                googleCalendarEventID,
            ]
        )
        csvOutputFileRowCount = csvOutputFileRowCount + 1
    csvOutputFile.close()
    return send_file(csvFilename, as_attachment=True, cache_timeout=0)


def downloadPblTeams(quarter):
    printLogEntry("downloadPblTeams() function called")
    # Create a CSV output file and append with a timestamp
    output_file_path = os.path.join(current_app.root_path, "static/download")
    output_file_path = "/tmp"
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    csvFilename = output_file_path + "/" + "pbl_teams_" + timestamp + ".csv"
    csvOutputFile = open(csvFilename, "w")
    csvOutputWriter = csv.writer(
        csvOutputFile, delimiter=",", quotechar='"', quoting=csv.QUOTE_MINIMAL
    )
    # Write header row for CSV file
    csvOutputWriter.writerow(
        [
            "Class",
            "School Year",
            "Semester",
            "Quarter",
            "Team Number",
            "Chatt State A Number",
            "Email",
            "First Name",
            "Last Name",
            "PBL Name",
        ]
    )
    csvOutputFileRowCount = 0
    # Query the PblEvents with a join to include PBL and student information
    # Note: outerjoin is necessary to retrieve records where PBL is not selected
    pblStudents = (
        db.session.query(PblTeams)
        .select_from(PblTeams)
        .outerjoin(Pbls)
        .join(Student)
        .filter(
            Pbls.schoolYear == getSchoolYearForQuarter(quarter),
            PblTeams.quarter == quarter,
        )
        .order_by(Pbls.pblName, PblTeams.pblTeamNumber, Student.lastName,)
    )

    print(pblStudents)
    # Process each record in the query and write to the output file
    for pblStudent in pblStudents:
        className = pblStudent.className
        schoolYear = pblStudent.schoolYear
        semester = pblStudent.semester
        quarter = pblStudent.quarter
        pblTeamNumber = pblStudent.pblTeamNumber
        chattStateANumber = pblStudent.chattStateANumber
        email = pblStudent.Student.email
        firstName = pblStudent.Student.firstName
        lastName = pblStudent.Student.lastName
        if pblStudent.Pbls:
            pblName = pblStudent.Pbls.pblName
        else:
            pblName = ""

        csvOutputWriter.writerow(
            [
                className,
                str(schoolYear),
                semester,
                str(quarter),
                pblTeamNumber,
                chattStateANumber,
                email,
                firstName,
                lastName,
                pblName,
            ]
        )
        csvOutputFileRowCount = csvOutputFileRowCount + 1
    csvOutputFile.close()
    return send_file(csvFilename, as_attachment=True, cache_timeout=0)


def downloadPblTeamsAndEventDetails(quarter, eventCategory):
    printLogEntry("downloadPblTeams() function called")
    # Create a CSV output file and append with a timestamp
    output_file_path = os.path.join(current_app.root_path, "static/download")
    output_file_path = "/tmp"
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    csvFilename = output_file_path + "/" + "pbl_teams_and_events_" + timestamp + ".csv"
    csvOutputFile = open(csvFilename, "w")
    csvOutputWriter = csv.writer(
        csvOutputFile, delimiter=",", quotechar='"', quoting=csv.QUOTE_MINIMAL
    )
    # Write header row for CSV file
    csvOutputWriter.writerow(
        [
            "Class",
            "School Year",
            "Semester",
            "Quarter",
            "Team Number",
            "Chatt State A Number",
            "Email",
            "First Name",
            "Last Name",
            "PBL Name",
            "Event Category",
            "Confirmed",
            "Event Date",
            "Start Time",
            "End Time",
            "Event Location",
            "Event Street Address",
            "Event City",
            "Event State",
            "Event Zip",
            "Event Comments",
        ]
    )
    csvOutputFileRowCount = 0
    # Query the PblEvents with a join to include PBL and student information
    pblStudents = (
        db.session.query(PblTeams, PblEvents)
        .select_from(PblTeams)
        .join(Pbls)
        .join(Pbls.PblEvents)
        .join(Student)
        .filter(
            Pbls.schoolYear == getSchoolYearForQuarter(quarter),
            Pbls.quarter == quarter,
            PblEvents.eventCategory == eventCategory,
        )
        .order_by(
            Pbls.quarter,
            PblEvents.eventDate,
            PblEvents.startTime,
            Pbls.pblName,
            PblTeams.pblTeamNumber,
            Student.lastName,
        )
    )

    print(pblStudents)
    # Process each record in the query and write to the output file
    for pblStudent in pblStudents:
        className = pblStudent[0].className
        schoolYear = pblStudent[0].schoolYear
        semester = pblStudent[0].semester
        quarter = pblStudent[0].quarter
        pblTeamNumber = pblStudent[0].pblTeamNumber
        chattStateANumber = pblStudent[0].chattStateANumber
        email = pblStudent[0].Student.email
        firstName = pblStudent[0].Student.firstName
        lastName = pblStudent[0].Student.lastName
        pblName = pblStudent[0].Pbls.pblName
        eventCategory = pblStudent[1].eventCategory
        confirmed = pblStudent[1].confirmed
        if pblStudent[1].eventDate:
            eventDate = pblStudent[1].eventDate
            startTime = pblStudent[1].startTime
            endTime = pblStudent[1].endTime
            eventDate = eventDate.strftime("%Y-%m-%d")
            startTime = startTime.strftime("%-I:%M %p")
            endTime = endTime.strftime("%-I:%M %p")
        else:
            eventDate = ""
            startTime = ""
            endTime = ""
        eventLocation = pblStudent[1].eventLocation
        eventStreetAddress1 = pblStudent[1].eventStreetAddress1
        eventCity = pblStudent[1].eventCity
        eventState = pblStudent[1].eventState
        eventZip = pblStudent[1].eventZip
        eventComments = pblStudent[1].eventComments
        googleCalendarEventID = pblStudent[1].googleCalendarEventID

        csvOutputWriter.writerow(
            [
                className,
                str(schoolYear),
                semester,
                str(quarter),
                pblTeamNumber,
                chattStateANumber,
                email,
                firstName,
                lastName,
                pblName,
                eventCategory,
                confirmed,
                eventDate,
                startTime,
                endTime,
                eventLocation,
                eventStreetAddress1,
                eventCity,
                eventState,
                eventZip,
                eventComments,
                googleCalendarEventID,
            ]
        )
        csvOutputFileRowCount = csvOutputFileRowCount + 1
    csvOutputFile.close()
    return send_file(csvFilename, as_attachment=True, cache_timeout=0)


def downloadPblFieldTripInfo(quarter):
    printLogEntry("downloadPblFieldTripDetails() function called")
    # Create a CSV output file and append with a timestamp
    output_file_path = os.path.join(current_app.root_path, "static/download")
    output_file_path = "/tmp"
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    csvFilename = output_file_path + "/" + "pbl_fieldtrip_" + timestamp + ".csv"
    csvOutputFile = open(csvFilename, "w")
    csvOutputWriter = csv.writer(
        csvOutputFile, delimiter=",", quotechar='"', quoting=csv.QUOTE_MINIMAL
    )
    # Write header row for CSV file
    csvOutputWriter.writerow(
        [
            "Class",
            "School Year",
            "Semester",
            "Quarter",
            "PBL Name",
            "Kickoff Event Date",
            "Kickoff Start Time",
            "Kickoff End Time",
            "Kickoff Event Location",
            "Kickoff Event Street Address",
            "Kickoff Event City",
            "Kickoff Event State",
            "Kickoff Event Zip",
            "Kickoff Event Comments",
            "Final Event Date",
            "Final Start Time",
            "Final End Time",
            "Final Event Location",
            "Final Event Street Address",
            "Final Event City",
            "Final Event State",
            "Final Event Zip",
            "Final Event Comments",
        ]
    )
    csvOutputFileRowCount = 0
    # Query the PblEvents with a join to include student information
    pblKickoffEvents = (
        PblEvents.query.join(Pbls)
        .filter(
            Pbls.schoolYear == getSchoolYearForQuarter(quarter),
            Pbls.quarter == quarter,
            PblEvents.eventCategory == "Kickoff",
        )
        .order_by(Pbls.pblName, PblEvents.eventCategory.desc())
    )
    pblFinalEvents = (
        PblEvents.query.join(Pbls)
        .filter(
            Pbls.schoolYear == getSchoolYearForQuarter(quarter),
            Pbls.quarter == quarter,
            PblEvents.eventCategory == "Final",
        )
        .order_by(Pbls.pblName, PblEvents.eventCategory.desc())
    )
    pblEvents = zip(pblKickoffEvents, pblFinalEvents)
    # Process each record in the query and write to the output file
    for pblEvent in pblEvents:
        className = pblEvent[0].Pbls.className
        schoolYear = pblEvent[0].Pbls.schoolYear
        semester = pblEvent[0].Pbls.semester
        quarter = pblEvent[0].Pbls.quarter
        pblName = pblEvent[0].Pbls.pblName
        if pblEvent[0].eventDate:
            eventDate = pblEvent[0].eventDate
            startTime = pblEvent[0].startTime
            endTime = pblEvent[0].endTime
            kickoff_eventDate = eventDate.strftime("%Y-%m-%d")
            kickoff_startTime = startTime.strftime("%-I:%M %p")
            kickoff_endTime = endTime.strftime("%-I:%M %p")
        else:
            kickoff_eventDate = ""
            kickoff_startTime = ""
            kickoff_endTime = ""
        kickoff_eventLocation = pblEvent[0].eventLocation
        kickoff_eventStreetAddress1 = pblEvent[0].eventStreetAddress1
        kickoff_eventCity = pblEvent[0].eventCity
        kickoff_eventState = pblEvent[0].eventState
        kickoff_eventZip = pblEvent[0].eventZip
        kickoff_eventComments = pblEvent[0].eventComments
        if pblEvent[1].eventDate:
            eventDate = pblEvent[1].eventDate
            startTime = pblEvent[1].startTime
            endTime = pblEvent[1].endTime
            final_eventDate = eventDate.strftime("%Y-%m-%d")
            final_startTime = startTime.strftime("%-I:%M %p")
            final_endTime = endTime.strftime("%-I:%M %p")
        else:
            final_eventDate = ""
            final_startTime = ""
            final_endTime = ""
        final_eventLocation = pblEvent[1].eventLocation
        final_eventStreetAddress1 = pblEvent[1].eventStreetAddress1
        final_eventCity = pblEvent[1].eventCity
        final_eventState = pblEvent[1].eventState
        final_eventZip = pblEvent[1].eventZip
        final_eventComments = pblEvent[1].eventComments

        csvOutputWriter.writerow(
            [
                className,
                str(schoolYear),
                semester,
                str(quarter),
                pblName,
                kickoff_eventDate,
                kickoff_startTime,
                kickoff_endTime,
                kickoff_eventLocation,
                kickoff_eventStreetAddress1,
                kickoff_eventCity,
                kickoff_eventState,
                kickoff_eventZip,
                kickoff_eventComments,
                final_eventDate,
                final_startTime,
                final_endTime,
                final_eventLocation,
                final_eventStreetAddress1,
                final_eventCity,
                final_eventState,
                final_eventZip,
                final_eventComments,
            ]
        )
        csvOutputFileRowCount = csvOutputFileRowCount + 1
    csvOutputFile.close()
    return send_file(csvFilename, as_attachment=True, cache_timeout=0)
