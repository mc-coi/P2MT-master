from flask import flash, current_app, send_file
from P2MT_App import db
from P2MT_App.models import Student, FacultyAndStaff, Parents
from datetime import datetime, date, time
from P2MT_App.main.utilityfunctions import printLogEntry, setToNoneIfEmptyString
from P2MT_App.main.referenceData import getClassYearOfGraduation
import csv
import os


# ###################
#    Student Info   #
# ###################

#  Add student info to database
def addStudentToDatabase(
    chattStateANumber,
    firstName,
    lastName,
    email,
    house,
    yearOfGraduation,
    googleCalendarId,
):
    printLogEntry("addStudentToDatabase() function called")
    # Only add the student if chattStateANumber is not already in the database
    if len(Student.query.filter_by(chattStateANumber=chattStateANumber).all()) == 0:
        student = Student(
            chattStateANumber=chattStateANumber,
            firstName=firstName,
            lastName=lastName,
            email=email,
            house=house,
            yearOfGraduation=int(yearOfGraduation),
            googleCalendarId=googleCalendarId,
        )
        print(student)
        db.session.add(student)
        db.session.commit()
    else:
        print("Student with chattStateANumber =", chattStateANumber, "already exists")
    return


def uploadStudentList(fname):
    printLogEntry("uploadStudentList() function called")
    csvFile = open(fname, "r")
    importCSV = csv.reader(csvFile)
    for row in importCSV:
        # Skip the first row if it has header row data
        if "Chatt_State_A_Number" in row:
            continue
        print("row=", row)
        chattStateANumber = row[0].strip()
        firstName = row[1].strip()
        lastName = row[2].strip()
        email = row[3].strip()
        yearOfGraduation = int(row[4].strip())
        house = row[5].strip()
        googleCalendarId = row[6].strip()
        addStudentToDatabase(
            chattStateANumber,
            firstName,
            lastName,
            email,
            house,
            yearOfGraduation,
            googleCalendarId,
        )
    return


def deleteStudent(chattStateANumber):
    printLogEntry("deleteStudent() function called")
    student = Student.query.filter_by(chattStateANumber=chattStateANumber).first()
    firstName = student.firstName
    lastName = student.lastName
    db.session.delete(student)
    db.session.commit()
    print("Student deleted from P2MT database:", chattStateANumber, firstName, lastName)
    flash("Student has been deleted!", "success")
    return


def downloadStudentList(exclude_graduates=True):
    printLogEntry("downloadStudentList() function called")
    # Create a CSV output file and append with a timestamp
    output_file_path = os.path.join(current_app.root_path, "static/download")
    output_file_path = "/tmp"
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    csvFilename = output_file_path + "/" + "student_list_" + timestamp + ".csv"
    csvOutputFile = open(csvFilename, "w")
    csvOutputWriter = csv.writer(
        csvOutputFile, delimiter=",", quotechar='"', quoting=csv.QUOTE_MINIMAL
    )
    # Write header row for CSV file
    csvOutputWriter.writerow(
        [
            "Chatt_State_A_Number",
            "First_Name",
            "Last_Name",
            "Student_Email",
            "Year_of_Graduation",
            "House",
            "googleCalendarID",
        ]
    )
    csvOutputFileRowCount = 0
    # Query Student for student information
    students = Student.query.order_by(Student.yearOfGraduation, Student.lastName)
    if exclude_graduates:
        senior_year_of_graduation = getClassYearOfGraduation("Seniors")
        students = students.filter(
            Student.yearOfGraduation >= senior_year_of_graduation
        )
    # Process each record in the query and write to the output file
    for student in students:
        chattStateANumber = student.chattStateANumber
        firstName = student.firstName
        lastName = student.lastName
        email = student.email
        yearOfGraduation = student.yearOfGraduation
        house = student.house
        googleCalendarId = student.googleCalendarId

        csvOutputWriter.writerow(
            [
                chattStateANumber,
                firstName,
                lastName,
                email,
                yearOfGraduation,
                house,
                googleCalendarId,
            ]
        )
        csvOutputFileRowCount = csvOutputFileRowCount + 1
    csvOutputFile.close()
    return send_file(csvFilename, as_attachment=True, cache_timeout=0)


# ###################
#    Staff Info     #
# ###################

# Add staff to database
def addStaffToDatabase(
    firstName,
    lastName,
    position,
    email,
    phoneNumber,
    chattStateANumber,
    myersBriggs,
    house,
    houseGrade,
    twitterAccount,
):
    printLogEntry("addStaffToDatabase() function called")
    # Only add the staff member if the name is not already in the database
    if (
        len(
            FacultyAndStaff.query.filter_by(
                firstName=firstName, lastName=lastName
            ).all()
        )
        == 0
    ):
        # Set empty strings to None (i.e. Null) for better data type management in database
        phoneNumber = setToNoneIfEmptyString(phoneNumber)
        chattStateANumber = setToNoneIfEmptyString(chattStateANumber)
        myersBriggs = setToNoneIfEmptyString(myersBriggs)
        house = setToNoneIfEmptyString(house)
        twitterAccount = setToNoneIfEmptyString(twitterAccount)
        houseGrade = setToNoneIfEmptyString(houseGrade)
        # Convert houseGrade from string to integer as required by database typing
        if isinstance(houseGrade, str):
            houseGrade = int(houseGrade)
        staff = FacultyAndStaff(
            firstName=firstName,
            lastName=lastName,
            position=position,
            email=email,
            phoneNumber=phoneNumber,
            chattStateANumber=chattStateANumber,
            myersBrigg=myersBriggs,
            house=house,
            houseGrade=houseGrade,
            twitterAccount=twitterAccount,
        )
        print(staff)
        db.session.add(staff)
        db.session.commit()
    else:
        print("Staff member", firstName, lastName, "already exists")
    return


def downloadStaffList():
    printLogEntry("downloadStaffList() function called")
    # Create a CSV output file and append with a timestamp
    output_file_path = os.path.join(current_app.root_path, "static/download")
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    output_file_path = "/tmp"
    csvFilename = output_file_path + "/" + "staff_list_" + timestamp + ".csv"
    csvOutputFile = open(csvFilename, "w")
    csvOutputWriter = csv.writer(
        csvOutputFile, delimiter=",", quotechar='"', quoting=csv.QUOTE_MINIMAL
    )
    # Write header row for CSV file
    csvOutputWriter.writerow(
        [
            "firstName",
            "lastName",
            "position",
            "email",
            "phoneNumber",
            "chattStateANumber",
            "house",
            "houseGrade",
            "myersBriggs",
            "twitterAccount",
        ]
    )
    csvOutputFileRowCount = 0
    # Query Student for student information
    staffMembers = FacultyAndStaff.query.order_by(FacultyAndStaff.lastName)
    # Process each record in the query and write to the output file
    for staff in staffMembers:
        firstName = staff.firstName
        lastName = staff.lastName
        position = staff.position
        email = staff.email
        phoneNumber = staff.phoneNumber
        chattStateANumber = staff.chattStateANumber
        house = staff.house
        houseGrade = staff.houseGrade
        myersBriggs = staff.myersBrigg
        twitterAccount = staff.twitterAccount

        csvOutputWriter.writerow(
            [
                firstName,
                lastName,
                position,
                email,
                phoneNumber,
                chattStateANumber,
                house,
                houseGrade,
                myersBriggs,
                twitterAccount,
            ]
        )
        csvOutputFileRowCount = csvOutputFileRowCount + 1
    csvOutputFile.close()
    return send_file(csvFilename, as_attachment=True, cache_timeout=0)


def uploadStaffList(fname):
    printLogEntry("uploadStaffList() function called")
    csvFile = open(fname, "r")
    importCSV = csv.reader(csvFile)
    for row in importCSV:
        # Skip the first row if it has header row data
        if "chattStateANumber" in row:
            continue
        print("row=", row)
        firstName = row[0].strip()
        lastName = row[1].strip()
        position = row[2].strip()
        email = row[3].strip()
        phoneNumber = row[4].strip()
        chattStateANumber = row[5].strip()
        myersBriggs = row[6].strip()
        house = row[7].strip()
        houseGrade = row[8].strip()
        # Set houseGrade=0 if undefined to avoid errors with integer conversions
        if len(houseGrade) > 0:
            houseGrade = int(houseGrade)
        else:
            houseGrade = 0
        twitterAccount = row[9].strip()
        addStaffToDatabase(
            firstName,
            lastName,
            position,
            email,
            phoneNumber,
            chattStateANumber,
            myersBriggs,
            house,
            houseGrade,
            twitterAccount,
        )
    return


def deleteStaff(log_id):
    printLogEntry("deleteStaff() function called")
    staff = FacultyAndStaff.query.filter_by(id=log_id).first()
    firstName = staff.firstName
    lastName = staff.lastName
    db.session.delete(staff)
    db.session.commit()
    print("Staff deleted from P2MT database:", firstName, lastName)
    flash("Staff member has been deleted!", "success")
    return


# ###################
#    Parent Info    #
# ###################


def addParentsToDatabase(
    chattStateANumber,
    guardianship,
    motherName,
    motherEmail,
    motherHomePhone,
    motherDayPhone,
    fatherName,
    fatherEmail,
    fatherHomePhone,
    fatherDayPhone,
    guardianEmail,
    comment,
):
    printLogEntry("addParentToDatabase() function called")
    # Only add the parent info if chattStateANumber is not already in the database
    if len(Parents.query.filter_by(chattStateANumber=chattStateANumber).all()) == 0:
        if len(Student.query.filter_by(chattStateANumber=chattStateANumber).all()) != 0:
            parents = Parents(
                chattStateANumber=chattStateANumber,
                guardianship=guardianship,
                motherName=motherName,
                motherEmail=motherEmail,
                motherHomePhone=motherHomePhone,
                motherDayPhone=motherDayPhone,
                fatherName=fatherName,
                fatherEmail=fatherEmail,
                fatherHomePhone=fatherHomePhone,
                fatherDayPhone=fatherDayPhone,
                guardianEmail=guardianEmail,
                comment=comment,
            )
            print(parents)
            db.session.add(parents)
            db.session.commit()
            print("Adding parents for chattStateANumber =", chattStateANumber)
        else:
            print("No student with chattStateANumber =", chattStateANumber, " exists")
    else:
        # If parent reccord exists, update the record with the new information
        print("Updating parents for chattStateANumber =", chattStateANumber)
        parents = Parents.query.filter_by(chattStateANumber=chattStateANumber).first()
        parents.chattStateANumber = chattStateANumber
        parents.guardianship = guardianship
        parents.motherName = motherName
        parents.motherEmail = motherEmail
        parents.motherHomePhone = motherHomePhone
        parents.motherDayPhone = motherDayPhone
        parents.fatherName = fatherName
        parents.fatherEmail = fatherEmail
        parents.fatherHomePhone = fatherHomePhone
        parents.fatherDayPhone = fatherDayPhone
        parents.guardianEmail = guardianEmail
        parents.comment = comment
        db.session.commit()
    return


def uploadParentsList(fname):
    printLogEntry("uploadParentList() function called")
    csvFile = open(fname, "r")
    importCSV = csv.reader(csvFile)
    for row in importCSV:
        # Skip the first row if it has header row data
        if "Chatt_State_A_Number" in row:
            continue
        print("row=", row)
        chattStateANumber = row[0].strip()
        # Ignore columns for student info (row[1], row[2], row[3]): student first name, last name, year of graduation
        guardianship = row[4].strip()
        motherName = row[5].strip()
        motherEmail = row[6].strip()
        motherHomePhone = row[7].strip()
        motherDayPhone = row[8].strip()
        fatherName = row[9].strip()
        fatherEmail = row[10].strip()
        fatherHomePhone = row[11].strip()
        fatherDayPhone = row[12].strip()
        guardianEmail = row[13].strip()
        comment = row[14].strip()
        addParentsToDatabase(
            chattStateANumber,
            guardianship,
            motherName,
            motherEmail,
            motherHomePhone,
            motherDayPhone,
            fatherName,
            fatherEmail,
            fatherHomePhone,
            fatherDayPhone,
            guardianEmail,
            comment,
        )
    return


def downloadParentsList(exclude_graduates=True):
    printLogEntry("downloadParentsList() function called")
    # Create a CSV output file and append with a timestamp
    output_file_path = os.path.join(current_app.root_path, "static/download")
    output_file_path = "/tmp"
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    csvFilename = output_file_path + "/" + "parent_list_" + timestamp + ".csv"
    csvOutputFile = open(csvFilename, "w")
    csvOutputWriter = csv.writer(
        csvOutputFile, delimiter=",", quotechar='"', quoting=csv.QUOTE_MINIMAL
    )
    # Write header row for CSV file
    csvOutputWriter.writerow(
        [
            "Chatt_State_A_Number",
            "student_FirstName",
            "student_LastName",
            "student_Year_of_Graduation",
            "Guardianship",
            "Mother",
            "Mothers_Email_Address",
            "Mothers_Home_Phone",
            "Mothers_Day_Phone",
            "Father",
            "Fathers_Email_Address",
            "Fathers_Home_Phone",
            "Fathers_Day_Phone",
            "Guardian_Email",
            "Comment",
        ]
    )
    csvOutputFileRowCount = 0
    # Query Student for student information
    parentInfo = Parents.query.join(Student).order_by(
        Student.yearOfGraduation, Student.lastName
    )
    if exclude_graduates:
        senior_year_of_graduation = getClassYearOfGraduation("Seniors")
        parentInfo = parentInfo.filter(
            Student.yearOfGraduation >= senior_year_of_graduation
        )
    # Process each record in the query and write to the output file
    for parent in parentInfo:
        chattStateANumber = parent.Student.chattStateANumber
        firstName = parent.Student.firstName
        lastName = parent.Student.lastName
        yearOfGraduation = parent.Student.yearOfGraduation
        guardianship = parent.guardianship
        motherName = parent.motherName
        motherEmail = parent.motherEmail
        motherHomePhone = parent.motherHomePhone
        motherDayPhone = parent.motherDayPhone
        fatherName = parent.fatherName
        fatherEmail = parent.fatherEmail
        fatherHomePhone = parent.fatherHomePhone
        fatherDayPhone = parent.fatherDayPhone
        guardianEmail = parent.guardianEmail
        comment = parent.comment

        csvOutputWriter.writerow(
            [
                chattStateANumber,
                firstName,
                lastName,
                yearOfGraduation,
                guardianship,
                motherName,
                motherEmail,
                motherHomePhone,
                motherDayPhone,
                fatherName,
                fatherEmail,
                fatherHomePhone,
                fatherDayPhone,
                guardianEmail,
                comment,
            ]
        )
        csvOutputFileRowCount = csvOutputFileRowCount + 1
    csvOutputFile.close()
    return send_file(csvFilename, as_attachment=True, cache_timeout=0)
