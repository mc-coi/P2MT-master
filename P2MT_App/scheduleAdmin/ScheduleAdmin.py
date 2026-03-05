from flask import send_file, current_app, flash, abort
from P2MT_App import db
from P2MT_App.models import ClassSchedule, ClassAttendanceLog, SchoolCalendar, Student
from P2MT_App.main.utilityfunctions import (
    download_File,
    printLogEntry,
    parse_time_string,
)
from P2MT_App.main.referenceData import isValidChattStateANumber
from datetime import datetime, date, time
import re
import os
import csv

print("\n=========", __file__, "=========\n")


def addClassAttendanceLog(classSchedule_id, list_of_dates):
    # Adds entries to class attendance log for a given classSchedule_id and list of dates
    # Ignores classes when inCurrentClassAttendaceLog is true
    printLogEntry("addClassAttendanceLog() function called")
    for classDate in list_of_dates:
        inCurrentClassAttendaceLog = ClassAttendanceLog.query.filter(
            ClassAttendanceLog.classSchedule_id == classSchedule_id,
            ClassAttendanceLog.classDate == classDate,
        ).all()
        # print("inCurrentClassAttendaceLog=", inCurrentClassAttendaceLog)
        if not inCurrentClassAttendaceLog:
            commentTuple = (
                db.session.query(ClassSchedule.comment)
                .filter(ClassSchedule.id == classSchedule_id)
                .first()
            )
            # comment = [item for item in commentTuple]
            classAttendanceLog = ClassAttendanceLog(
                classSchedule_id=classSchedule_id,
                classDate=classDate,
                comment=commentTuple[0],
                # attendanceCode=attendanceCode,
                # assignTmi=assignTmi,
            )
            print(classAttendanceLog)
            db.session.add(classAttendanceLog)
            db.session.commit()


def getDuplicateSchedule(
    schoolYear,
    semester,
    chattStateANumber,
    campus,
    className,
    teacherLastName,
    staffID,
    online,
    indStudy,
    classDays,
    startTime,
    endTime,
    learningLab,
):
    """Check whether schedule already exists and returns it if so."""
    printLogEntry("Running getDuplicateSchedule()")
    duplicateSchedule = ClassSchedule.query.filter(
        ClassSchedule.schoolYear == schoolYear,
        ClassSchedule.semester == semester,
        ClassSchedule.chattStateANumber == chattStateANumber,
        ClassSchedule.campus == campus,
        ClassSchedule.className == className,
        ClassSchedule.teacherLastName == teacherLastName,
        ClassSchedule.staffID == staffID,
        ClassSchedule.online == online,
        ClassSchedule.indStudy == indStudy,
        ClassSchedule.classDays == classDays,
        ClassSchedule.startTime == startTime,
        ClassSchedule.endTime == endTime,
        ClassSchedule.learningLab == learningLab,
    ).first()
    return duplicateSchedule


# Add class schedule information to database
def addClassSchedule(
    schoolYear,
    semester,
    chattStateANumber,
    campus,
    className,
    teacherLastName,
    staffID,
    online,
    indStudy,
    classDays,
    startTime,
    endTime,
    comment,
    googleCalendarEventID,
    interventionLog_id,
    learningLab,
):
    """Add new class schedule to the database."""
    classSchedule1 = ClassSchedule(
        schoolYear=schoolYear,
        semester=semester,
        chattStateANumber=chattStateANumber,
        campus=campus,
        className=className,
        teacherLastName=teacherLastName,
        staffID=staffID,
        online=online,
        indStudy=indStudy,
        classDays=classDays,
        startTime=startTime,
        endTime=endTime,
        comment=comment,
        googleCalendarEventID=googleCalendarEventID,
        interventionLog_id=interventionLog_id,
        learningLab=learningLab,
    )
    printLogEntry("addClassSchedule() function called")
    print(classSchedule1)
    print("Learning Lab =", learningLab)
    db.session.add(classSchedule1)
    # remove db.session.commit() and handle commit in the calling function
    # db.session.commit()
    return classSchedule1


def get_html_row(row):
    """Return an html table row constructed from a string of comma-separated values."""
    printLogEntry("get_html_row() function called")
    columns = row.split(",")
    html_row = "<tr>"
    for column in columns:
        html_cell = f"<td>{column}</td>"
        html_row = html_row + html_cell
    html_row = html_row + "</tr>"
    return html_row


def get_html_table(*rows):
    """Return an html table constructed from rows of comma-separated values."""
    html_table = "<div style='display: block; overflow-x: auto; white-space: nowrap;'><table class='w3-table-all'>"
    html_rows = ""
    for row in rows:
        print(row)
        html_row = get_html_row(row)
        html_rows = html_rows + html_row
    html_table = html_table + html_rows + "</table></div>"
    return html_table


def uploadSchedules(fname):
    printLogEntry("uploadSchedules() function called")
    header_row = "year, semester, Chatt_State_A_Number, CSname (optional), firstName (optional),lastName (optional), HSclass (optional),campus, courseNumber (optional),courseName, sectionID (optional),teacher (optional), online (1 if true), indStudy (1 if true),days, times (optional), startTime, endTime, comment (optional),googleCalendarEventID (optional)"
    correct_row_example_1 = (
        "2022,Spring,A12345678,,,,,STEM School,,Coding,,McCoy,,,MW,,9:30 AM,10:30 AM,,"
    )
    correct_row_example_2 = "2021,Fall,A12345678,Tester Smarty,Smarty,Tester,2023,STEM School,,ACT Review English,,Stanley,0,0,MW,1:00 - 2:00,1:00 PM,2:00 PM,,az19ac0sc7tdj95os2otm7elv4@google.com,"
    correct_row_example_3 = "2021,Fall,A12345678,Tester Smarty,Smarty,Tester,2022,Chattanooga State,83985,Calculus 2,MATH 1920 - 130,,,,MTWR,11:00-11:50,11:00 AM,11:50 AM,,by28uf8vdnum9h4ett48n7end4@google.com"
    table_of_valid_examples = get_html_table(
        "Example:,Header Row",
        header_row,
        "Example:,Minimum Information",
        correct_row_example_1,
        "Example:,Typical STEM School Class",
        correct_row_example_2,
        "Example:,Typical Chatt State Class",
        correct_row_example_3,
    )
    error_note = f"""Examples of Valid Rows: <br><br>{table_of_valid_examples}<br><br>
                        Note: Common errors include commas within fields, blank time fields, and incorrect Chatt State A Numbers.  Optional fields indicated by adjacent commas are permissable and necesary."""
    importCSV = open(fname, "r")
    print(importCSV)
    row_number = 0
    duplicate_counter = 0
    new_counter = 0
    for row in importCSV:
        row_number += 1
        print(f"row {row_number} = {row}")
        column = row.split(",")
        column_count = len(column)
        if column_count != 20:
            if column_count < 20:
                column_error = "Missing columns"
            else:
                column_error = "Extra columns"
            error = f"""<br><br>Error processing class schedule: {column_error}<br><br>
                        Submitted Number of Columns: {column_count} <br><br>
                        Correct Number of Columns: 20<br><br>
                        Check this row for errors:<br><br>
                        Row Number: {row_number}<br><br>
                        {get_html_table(row)}<br><br>
                        {error_note}
                        """
            print(error)
            return abort(500, description=error)
        print("column=", column)
        schoolYear = column[0].strip()
        if schoolYear == "year":
            continue
        elif row_number == 1:
            error = f"""<br><br>Error processing class schedule: Invalid header row<br><br>
                        See below for an example of the correct header row.<br><br>
                        Check this row for errors:<br><br>
                        Row Number: {row_number}<br><br>
                        {get_html_table(row)}<br><br>
                        {error_note}
                        """
            print(error)
            return abort(500, description=error)
        semester = column[1].strip()
        chattStateANumber = column[2].strip()
        # validate student
        if not isValidChattStateANumber(chattStateANumber):
            error = f"""<br><br>Error processing class schedule: Invalid Chatt State A Number<br><br>
                        This error indicates there is no student with this Chatt State A Number.
                        It may be necessary to update or add a student with this Chatt State A Number.<br><br>
                        chattStateANumber: {column[2]} <br><br>
                        Check this row for errors:<br><br>
                        Row Number: {row_number}<br><br>
                        {get_html_table(header_row, row)}<br><br>
                        {error_note}
                        """
            print(error)
            return abort(500, description=error)
        campus = column[7].strip()
        className = column[9].strip()
        teacherLastName = column[11].strip()
        staffID = None
        online = column[12].strip()
        if online == "1":
            online = True
        else:
            online = False
        indStudy = column[13].strip()
        if indStudy == "1":
            indStudy = True
        else:
            indStudy = False
        classDays = column[14].strip()
        print(column[16].strip())
        try:
            startTime = parse_time_string(column[16].strip())
            endTime = parse_time_string(column[17].strip())
        except Exception as err:
            print(err)
            flash("Error processing class time")
            error = f"""<br><br>Error processing class schedule: Invalid class time<br><br>
            startTime: {column[16]} <br><br>
            endTime: {column[17]} <br><br>
            If the startTime and endTime values are blank or do not show what is listed in the CSV file, either there was no data found in those fields or there may be extra commas in the row which are offsetting the import of the correct fields.<br><br>
            Check this row for errors:<br><br>
            Row Number: {row_number}<br><br>
            {get_html_table(header_row, row)}<br><br>
            Valid Time Formats:<br><br>
            9:30 AM<br><br>
            09:30 AM<br><br>
            9:30<br><br>
            09:30<br><br>
            1:30 PM<br><br>
            13:30 PM<br><br>
            13:30 PM<br><br>
            13:30<br><br>
            Invalid Time Formats:<br><br>
            9:30:00 AM (do not include seconds)<br><br>
            {error_note}<br><br>
            Time Format Processing Information:<br><br>
            Failed: %I:%M %p (12-hour clock) as a decimal number.	1, 2, ... 12 <br>
            Failed: %-I:%M %p (12-hour clock) as a decimal number.	1, 2, ... 12 <br>
            Failed: %H:%M %p (24-hour clock) as a zero-padded decimal number.	00, 01, ..., 23 <br>
            Failed: %-H:%M %p (24-hour clock) as a decimal number.	0, 1, ..., 23 <br>
            Failed: %H:%M (24-hour clock) as a decimal number.	0, 1, ..., 23 <br><br>
            """
            return abort(500, description=error)
        comment = column[18].strip()
        googleCalendarEventID = ""
        interventionLog_id = None
        learningLab = False
        # try:
        duplicateSchedule = getDuplicateSchedule(
            schoolYear,
            semester,
            chattStateANumber,
            campus,
            className,
            teacherLastName,
            staffID,
            online,
            indStudy,
            classDays,
            startTime,
            endTime,
            learningLab,
        )
        if duplicateSchedule:
            print(
                "Duplicate schedule found:",
                schoolYear,
                semester,
                chattStateANumber,
                campus,
                className,
                teacherLastName,
                staffID,
                online,
                indStudy,
                classDays,
                startTime,
                endTime,
                learningLab,
            )
            duplicate_counter += 1
        else:
            addClassSchedule(
                schoolYear,
                semester,
                chattStateANumber,
                campus,
                className,
                teacherLastName,
                staffID,
                online,
                indStudy,
                classDays,
                startTime,
                endTime,
                comment,
                googleCalendarEventID,
                interventionLog_id,
                learningLab,
            )
            new_counter += 1
    db.session.commit()
    flash(
        f"{new_counter} schedules added, {duplicate_counter} duplicate schedules ignored",
        "success",
    )
    return True


def deleteClassSchedule(schoolYear, semester, yearOfGraduation):
    printLogEntry("deleteClassSchedule() function called")
    classSchedules = (
        ClassSchedule.query.join(Student)
        .filter(
            ClassSchedule.schoolYear == schoolYear,
            ClassSchedule.semester == semester,
            Student.yearOfGraduation == yearOfGraduation,
        )
        .all()
    )
    for classSchedule in classSchedules:
        db.session.delete(classSchedule)
        db.session.commit()
    return


def downloadClassSchedule(schoolYear, semester):
    printLogEntry("downloadClassSchedule() function called")
    # Create a CSV output file and append with a timestamp
    output_file_path = os.path.join(current_app.root_path, "static/download")
    output_file_path = "/tmp"
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    csvFilename = output_file_path + "/" + "class_schedule_" + timestamp + ".csv"
    csvOutputFile = open(csvFilename, "w")
    csvOutputWriter = csv.writer(
        csvOutputFile, delimiter=",", quotechar='"', quoting=csv.QUOTE_MINIMAL
    )
    # Write header row for CSV file
    csvOutputWriter.writerow(
        [
            "year",
            "semester",
            "Chatt_State_A_Number",
            "CSname",
            "firstName",
            "lastName",
            "HSclass",
            "campus",
            "courseNumber",
            "courseName",
            "sectionID",
            "teacher",
            "online",
            "indStudy",
            "days",
            "times",
            "startTime",
            "endTime",
            "comment",
            "googleCalendarEventID",
        ]
    )
    csvOutputFileRowCount = 0
    # Query the ClassSchedule with a join to include student information
    ClassSchedules = ClassSchedule.query.filter(
        ClassSchedule.schoolYear == schoolYear,
        ClassSchedule.semester == semester,
        ClassSchedule.learningLab == False,
    ).order_by(ClassSchedule.chattStateANumber.desc())
    # Process each record in the query and write to the output file
    for classSchedule in ClassSchedules:
        chattStateANumber = classSchedule.chattStateANumber
        lastName = classSchedule.Student.lastName
        firstName = classSchedule.Student.firstName
        CSname = lastName + " " + firstName
        HSclass = classSchedule.Student.yearOfGraduation
        campus = classSchedule.campus
        courseNumber = ""
        courseName = classSchedule.className
        sectionID = ""
        teacher = classSchedule.teacherLastName
        online = classSchedule.online
        if online:
            online = "1"
        else:
            online = "0"
        indStudy = classSchedule.indStudy
        if indStudy:
            indStudy = "1"
        else:
            indStudy = "0"
        days = classSchedule.classDays
        startTime = classSchedule.startTime
        endTime = classSchedule.endTime
        comment = classSchedule.comment
        googleCalendarEventID = classSchedule.googleCalendarEventID

        csvOutputWriter.writerow(
            [
                str(schoolYear),
                semester,
                chattStateANumber,
                CSname,
                firstName,
                lastName,
                str(HSclass),
                campus,
                courseNumber,
                courseName,
                str(sectionID),
                teacher,
                online,
                indStudy,
                days,
                startTime.strftime("%-I:%M") + " - " + endTime.strftime("%-I:%M"),
                startTime.strftime("%-I:%M %p"),
                endTime.strftime("%-I:%M %p"),
                comment,
                googleCalendarEventID,
            ]
        )
        csvOutputFileRowCount = csvOutputFileRowCount + 1
    csvOutputFile.close()
    return send_file(csvFilename, as_attachment=True, cache_timeout=0)


def downloadClassAttendanceLog(schoolYear, semester, teacherName, startDate, endDate):
    printLogEntry("downloadClassAttendanceLog() function called")
    # Create a CSV output file and append with a timestamp
    output_file_path = os.path.join(current_app.root_path, "static/download")
    output_file_path = "/tmp"
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    csvFilename = output_file_path + "/" + "class_attendance_" + timestamp + ".csv"
    csvOutputFile = open(csvFilename, "w")
    csvOutputWriter = csv.writer(
        csvOutputFile, delimiter=",", quotechar='"', quoting=csv.QUOTE_MINIMAL
    )
    # Write header row for CSV file
    csvOutputWriter.writerow(
        [
            "teacher",
            "className",
            "day",
            "classDate",
            "startTime",
            "endTime",
            "firstName",
            "lastName",
            "attendanceCode",
            "comment",
        ]
    )
    csvOutputFileRowCount = 0
    # Query for class attendance records
    ClassAttendanceLogs = (
        ClassAttendanceLog.query.join(ClassSchedule)
        .join(ClassSchedule.Student)
        .filter(
            ClassSchedule.schoolYear == schoolYear,
            ClassSchedule.semester == semester,
            ClassSchedule.teacherLastName == teacherName,
            ClassAttendanceLog.classDate >= startDate,
            ClassAttendanceLog.classDate <= endDate,
        )
        .order_by(ClassAttendanceLog.classDate)
        .order_by(ClassSchedule.startTime)
        .order_by(ClassSchedule.className)
        .order_by(Student.lastName)
    )
    # Process each record in the query and write to the output file
    for classAttendanceLog in ClassAttendanceLogs:
        csvOutputWriter.writerow(
            [
                classAttendanceLog.ClassSchedule.teacherLastName,
                classAttendanceLog.ClassSchedule.className,
                classAttendanceLog.classDate.strftime("%a"),
                classAttendanceLog.classDate.strftime("%Y-%m-%d"),
                classAttendanceLog.ClassSchedule.startTime.strftime("%-I:%M %p"),
                classAttendanceLog.ClassSchedule.endTime.strftime("%-I:%M %p"),
                classAttendanceLog.ClassSchedule.Student.firstName,
                classAttendanceLog.ClassSchedule.Student.lastName,
                classAttendanceLog.attendanceCode,
                classAttendanceLog.comment,
            ]
        )

        csvElementCounter = 1
        csvOutputFileRowCount = csvOutputFileRowCount + 1
    csvOutputFile.close()
    return send_file(csvFilename, as_attachment=True, cache_timeout=0)


def createListOfDates(SchoolCalendarTableExtract):
    dateList = []
    for day in SchoolCalendarTableExtract:
        dateList.append(day.classDate)
    return dateList


def propagateClassSchedule(startDate, endDate, schoolYear, semester):
    printLogEntry("propagateClassSchedule() function called")
    # Create lists of days to use for propagating class schedule
    schoolCalendar = db.session.query(SchoolCalendar)
    phaseIIDays = schoolCalendar.filter(SchoolCalendar.phaseIISchoolDay)
    dateRange = phaseIIDays.filter(
        SchoolCalendar.classDate >= startDate, SchoolCalendar.classDate <= endDate
    )
    list_of_mondays = createListOfDates(
        dateRange.filter(SchoolCalendar.day == "M").all()
    )
    # print(list_of_mondays)
    list_of_tuesdays = createListOfDates(
        dateRange.filter(SchoolCalendar.day == "T").all()
    )
    # print(list_of_tuesdays)
    list_of_wednesdays = createListOfDates(
        dateRange.filter(SchoolCalendar.day == "W").all()
    )
    list_of_thursdays = createListOfDates(
        dateRange.filter(SchoolCalendar.day == "R").all()
    )
    list_of_fridays = createListOfDates(
        dateRange.filter(SchoolCalendar.day == "F").all()
    )
    # Extract details from class schedule
    classSchedules = (
        ClassSchedule.query.filter(ClassSchedule.semester == semester)
        .filter(
            ClassSchedule.schoolYear == schoolYear,
            ClassSchedule.campus == "STEM School",
        )
        .all()
    )
    number_of_class_schedules = len(classSchedules)
    print("Total number of rows in classSchedules:", number_of_class_schedules)
    for classSchedule in classSchedules:
        classSchedule_id = classSchedule.id
        online = classSchedule.online
        indStudy = classSchedule.indStudy
        classDays = classSchedule.classDays
        meetsOnMonday = re.search("[M]", classDays)
        meetsOnTuesday = re.search("[T]", classDays)
        meetsOnWednesday = re.search("[W]", classDays)
        meetsOnThursday = re.search("[R]", classDays)
        meetsOnFriday = re.search("[F]", classDays)
        if meetsOnMonday and not online and not indStudy:
            # print("Monday:", classSchedule_id, classDays)
            addClassAttendanceLog(classSchedule_id, list_of_mondays)
        if meetsOnTuesday and not online and not indStudy:
            # print("Tuesday:", classSchedule_id, classDays)
            addClassAttendanceLog(classSchedule_id, list_of_tuesdays)
        if meetsOnWednesday and not online and not indStudy:
            # print("Wednesday:", classSchedule_id, classDays)
            addClassAttendanceLog(classSchedule_id, list_of_wednesdays)
        if meetsOnThursday and not online and not indStudy:
            # print("Thursday:", classSchedule_id, classDays)
            addClassAttendanceLog(classSchedule_id, list_of_thursdays)
        if meetsOnFriday and not online and not indStudy:
            # print("Friday:", classSchedule_id, classDays)
            addClassAttendanceLog(classSchedule_id, list_of_fridays)
    return number_of_class_schedules
