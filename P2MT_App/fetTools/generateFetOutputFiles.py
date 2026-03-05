import re
import json
from datetime import datetime
from datetime import timedelta
import sys, traceback


def getFetField(fetRow, element):
    fetField = fetRow[element].strip('"')
    fetField = fetField.strip()
    return fetField


def getDayTuple(day):
    if day == "Monday":
        dayTuple = (1, "M", "Monday")
    elif day == "Tuesday":
        dayTuple = (2, "T", "Tuesday")
    elif day == "Wednesday":
        dayTuple = (3, "W", "Wednesday")
    elif day == "Thursday":
        dayTuple = (4, "R", "Thursday")
    elif day == "Friday":
        dayTuple = (5, "F", "Friday")
    elif day == "Saturday":
        dayTuple = (6, "Sa", "Saturday")
    elif day == "Sunday":
        dayTuple = (7, "Su", "Sunday")
    else:
        day = "Error: invalid day"
    return dayTuple


def getChattStateANumber(studentSets):
    chattStateANumber = re.findall("^A[0-9]+", studentSets)
    # Check if student set is for a student or a team
    if len(chattStateANumber) < 1:
        chattStateANumber = studentSets
    else:
        chattStateANumber = chattStateANumber[0]
    return chattStateANumber


def getName(studentSets, nameType):
    nameList = studentSets.split("_")
    # Check if student set is for a student or a team
    if len(nameList) == 1:
        name = studentSets
    elif nameType == "lastName":
        name = nameList[1]
    elif nameType == "firstName":
        name = nameList[2]
    return name


def getCampus(activityTags):
    if re.search("^SS", activityTags):
        campus = "STEM School"
    elif re.search("^CS", activityTags):
        campus = "Chattanooga State"
    else:
        campus = "Unknown"
    return campus


def getOnline(activityTags):
    if re.search("www", activityTags):
        online = 1
    else:
        online = 0
    return online


def createTimeObject(timeString):
    # Parse a time string into a datetime object
    timeObject = datetime.strptime(timeString, "%H:%M")
    return timeObject


def extractStartEndTimeFromActivityTag(activityTags):
    # Parse the start and end times from the activityTags
    times = re.findall("[0-9]+:[0-9]+", activityTags)
    # These functions ensure the proper determination of AM and PM
    # when parsing the time in H:MM format from the activity tags
    # Edge case scenarios:
    #   startTime = 7:00 PM, endTime = 8:30 PM
    #   startTime = 8:00 AM, endTime = 8:50 AM
    # Assumptions:
    # 1. Class start times are between 8:00 AM and 7:59 PM
    # 2. No classes start at 8 PM or later
    # 3. Class end times may occur after 8 PM
    # 4. If the class start time is AM, the class end time may be either AM or PM
    # 5. If the class start time is PM, the class end time must be PM
    # 6. No class will begin before 12:00 PM and end after 7:00 PM
    startTime = adjustTimeObjectForAmPm(createTimeObject(times[0]))
    # Note: startTime.hour is 0 to 23
    if startTime.hour > 11:
        # Create the endTime so it is PM (i.e., add 12 hours=720 minutes to shift to PM)
        # endTime = createTimeObject(times[1])
        # if endTime.hour < 12 :
        #     endTime = addTime(endTime,720)
        endTime = createTimeObject(times[1])
        # print(endTime)
        # Check if the end time is before 12 PM (this check prevents the 12:00 PM - 12:50 AM problem)
        if endTime.hour < 12:
            endTime = addTime(endTime, 720)
            # print(endTime)
        # endTime = addTime(createTimeObject(times[1]),720)
    # if startTime isn't 12 PM or later, then use the normal rules to determine AM/PM
    else:
        endTime = adjustTimeObjectForAmPm(createTimeObject(times[1]))
    # print(startTime,endTime)
    return startTime, endTime


def adjustTimeObjectForAmPm(dateTimeObject):
    if dateTimeObject.hour > 0 and dateTimeObject.hour < 8:
        newHour = dateTimeObject.hour + 12
        adjustedTimeStr = str(newHour) + ":" + str(dateTimeObject.minute)
        dateTimeObject = createTimeObject(adjustedTimeStr)
    return dateTimeObject


def addTime(baseTimeObject, addedTimeInMinutes):
    # baseTime is a datetime object representing time as HH:MM using 24-hour clock
    addedTimeDelta = timedelta(minutes=addedTimeInMinutes)
    newTimeObject = baseTimeObject + addedTimeDelta
    return newTimeObject


def getTimeStringWithoutAMPM(dateTimeObject):
    # Convert dateTime object into a time string with format h:mm
    timeStringHMM = dateTimeObject.strftime("%-I:%M")
    return timeStringHMM


def getTimeStringWithAMPM(dateTimeObject):
    # Convert dateTime object into a time string with format h:mm
    timeStringHMM = dateTimeObject.strftime("%-I:%M %p")
    return timeStringHMM


def ripFetFiles(
    HSclass,
    schoolYear,
    semester,
    student_file_name,
    class_teacher_fileName,
    fetFileName,
    output_file_path,
):
    print("\n\n\n\n")
    print("=======================================")
    print("===   Generating FET Output Files   ===")
    print("===  ", datetime.now(), "   ===")
    print("=======================================")
    print("\n\n")
    run_program = True
    while run_program:
        try:
            # Prompt user for student input file, FET input file, year of graduation, school year, and semester
            # student_file_name = input('Enter the name of the student input file (in CSV format)')
            # if len(student_file_name) < 1 : student_file_name = 'FET Schedule Input Files 2020-2021 - FET Students - Juniors (1).csv'
            student_file = open(student_file_name)
            # fetFileName = input('Enter the name of the FET timetable (in CSV format)')
            # if len(fetFileName) < 1 : fetFileName = 'Fall 2020 Juniors Scheduling (1)_timetable.csv'
            fetFileHandle = open(fetFileName)
            # HSclass = input('Enter the year of graduation (YYYY)')
            # if len(HSclass) < 1 : HSclass = '2022'
            # schoolYear = input('Enter the school year (YYYY)')
            # if len(schoolYear) < 1 : schoolYear = '2020'
            # semester = input('Enter the semester (Fall or Spring)')
            # if len(semester) < 1 : semester = 'Fall'
            classTeacher_file = open(class_teacher_fileName)
        except:
            print("===Error with input data===")
            print("Exception in user code:")
            print("-" * 60)
            traceback.print_exc(file=sys.stdout)
            print("-" * 60)
            break

        # Create a team-student mapping dictionary
        try:
            teamStudentMap = dict()
            for row in student_file:
                rowValues = row.split(",")
                teamName = rowValues[2]
                studentSets = rowValues[4]
                chattStateANumber = getChattStateANumber(studentSets)
                firstName = getName(studentSets, "firstName")
                lastName = getName(studentSets, "lastName")
                if len(studentSets) == 0:
                    continue
                if teamName == "Group":
                    continue
                if teamName not in teamStudentMap:
                    teamStudentMap.update({teamName: {"students": {}}})
                teamStudentMap[teamName]["students"].update(
                    {chattStateANumber: {"firstName": firstName, "lastName": lastName}}
                )

            jsonTeamStudentMap = json.dumps(
                teamStudentMap, indent=4, separators=("", " = ")
            )
            # print(jsonTeamStudentMap)
        except:
            print("===Error creating team-student mapping dictionary")
            break

        # Create a class-teacher mapping dictionary
        try:
            classTeacherMap = dict()
            for row in classTeacher_file:
                rowValues = row.split(",")
                className = rowValues[0].strip()
                teacherName = rowValues[1].strip()
                classTeacherMap.update({className: teacherName})

            jsonClassTeacherMap = json.dumps(
                classTeacherMap, indent=4, separators=("", " = ")
            )
            print(jsonClassTeacherMap)
        except:
            print("===Error creating class-teacher mapping dictionary")
            break

        try:
            # Inport the FET timetable file into a Python dictionary
            timetable = list()
            fullSchedule = dict()
            scheduleRow = dict()
            studentSchedules = dict()
            fetTimeTableCounter = 0

            for line in fetFileHandle:
                line = line.strip()
                activity_elements = line.split(",")
                timetable.append(activity_elements)
                fetTimeTableCounter = fetTimeTableCounter + 1
            print(
                fetTimeTableCounter, " lines imported from FET time table",
            )
        except:
            print("===Error importing FET timetable file===")
            print("Exception in user code:")
            print("-" * 60)
            traceback.print_exc(file=sys.stdout)
            print("-" * 60)
            break

        try:
            # Process the FET timetable into the fullSchedule Python dictionary
            currentActivityId = 0
            currentFetRow = 0
            activityCounter = 0
            # Remove the very first row consisting of FET timetable field names
            timetable.pop(0)
            for fetRow in timetable:
                # Check to make sure first row contains a valid activity
                try:
                    activityId = int(getFetField(fetRow, 0))
                except:
                    print("Activity ID for row number", currentFetRow + 1, "is invalid")
                    print("Exception in user code:")
                    print("-" * 60)
                    traceback.print_exc(file=sys.stdout)
                    print("-" * 60)
                    break

                # Extract the schedule parameters from the FET timetable
                subject = getFetField(fetRow, 4)
                teacher = getFetField(fetRow, 5)
                activityTags = getFetField(fetRow, 6)
                campus = getCampus(activityTags)
                room = getFetField(fetRow, 7)
                comments = getFetField(fetRow, 8)
                online = getOnline(activityTags)
                # Convert the full name of the day to a day tuple (e.g., (3,W,Wednesday))
                # to simplify conversion to sorted day codes like MW or TR or MWF
                day = [getDayTuple(getFetField(fetRow, 1))]
                if online == True:
                    startTime = createTimeObject("08:00")
                    endTime = createTimeObject("08:30")

                elif campus == "Chattanooga State":
                    # Extract the starting time from the activityTags
                    # Note: this is necessary since Chatt State classes do not always start and end at :00 and :30 minutes
                    startTime, endTime = extractStartEndTimeFromActivityTag(
                        activityTags
                    )

                else:
                    # Extract the starting time for the current activity
                    # Note: the startTime will only be recorded the first time an activity appears
                    # This is because FET includes multiple rows for activities for each FET time block
                    # print('activityID = ' + activityID + ' campus = ' + campus)
                    startTime = createTimeObject(getFetField(fetRow, 2))
                    # Set the end time by adding 30 minutes to the time of the current activity
                    # Note: the endTime will be updated each time there is a new row for the same activity
                    endTime = addTime(startTime, 30)

                # Add the name of the teacher for any class listed in the classTeacherMap
                if subject in classTeacherMap:
                    teacher = classTeacherMap[subject]

                studentSets = getFetField(fetRow, 3)
                chattStateANumber = getChattStateANumber(studentSets)
                firstName = getName(studentSets, "firstName")
                lastName = getName(studentSets, "lastName")
                studentTupleList = [(chattStateANumber, firstName, lastName)]
                # Check if this activity is for a team.  If so, break out the individual students
                if studentSets in teamStudentMap:
                    studentTupleList = []
                    comments = comments + " " + studentSets
                    for student in teamStudentMap[studentSets]["students"]:
                        chattStateANumber = student
                        firstName = teamStudentMap[studentSets]["students"][student][
                            "firstName"
                        ]
                        lastName = teamStudentMap[studentSets]["students"][student][
                            "lastName"
                        ]
                        studentTuple = [(chattStateANumber, firstName, lastName)]
                        studentTupleList = studentTupleList + studentTuple

                # Process the activity for a single student or team of students
                for studentTuple in studentTupleList:
                    chattStateANumber = studentTuple[0]
                    firstName = studentTuple[1]
                    lastName = studentTuple[2]
                    # print(chattStateANumber,firstName,lastName)

                    # Add the student to fullSchedule if the student is not already in fullSchedule
                    if chattStateANumber not in fullSchedule:
                        fullSchedule.update(
                            {
                                chattStateANumber: {
                                    "firstName": firstName,
                                    "lastName": lastName,
                                    "activities": {},
                                }
                            }
                        )

                    # If this activity ID is already in fullSchedule, only update the endTime and move on
                    if activityId in fullSchedule[chattStateANumber]["activities"]:
                        fullSchedule[chattStateANumber]["activities"][activityId][
                            "endTime"
                        ] = endTime
                        print(
                            str(activityId),
                            lastName,
                            firstName,
                            campus,
                            subject,
                            startTime,
                            endTime,
                            activityTags,
                            comments,
                            sep="...",
                        )
                    # If this activity is not in fullSchedule, populate the scheduleRow dictionary with key-value pairs
                    else:
                        scheduleRow = {
                            "day": day,
                            "startTime": startTime,
                            "endTime": endTime,
                            "subject": subject,
                            "campus": campus,
                            "teacher": teacher,
                            "online": online,
                            "comments": comments,
                            "activityTags": activityTags,
                            "mergedActivity": False,
                        }
                        print(
                            str(activityId),
                            lastName,
                            firstName,
                            campus,
                            subject,
                            startTime,
                            endTime,
                            activityTags,
                            comments,
                            sep="+++",
                        )
                        # print(startTime, endTime)
                        # Add the scheduleRow to the full schedule dictionary
                        fullSchedule[chattStateANumber]["activities"].update(
                            {activityId: scheduleRow}
                        )
                        activityCounter = activityCounter + 1
                    currentFetRow = currentFetRow + 1
        except:
            print(
                "===Error processing FET timetable into full schedule dictionary",
                sys.exc_info()[0],
            )
            print("Exception in user code:")
            print("-" * 60)
            traceback.print_exc(file=sys.stdout)
            print("-" * 60)
            break

        try:
            # Loop through each student's schedule and merge classes spread across days into consolidated class listings
            for student in fullSchedule:
                for activity in fullSchedule[student]["activities"]:
                    # print(fullSchedule[student]["activities"][activity])
                    subject = fullSchedule[student]["activities"][activity]["subject"]
                    day = fullSchedule[student]["activities"][activity]["day"]
                    startTime = fullSchedule[student]["activities"][activity][
                        "startTime"
                    ]
                    endTime = fullSchedule[student]["activities"][activity]["endTime"]
                    campus = fullSchedule[student]["activities"][activity]["campus"]
                    mergedActivity = fullSchedule[student]["activities"][activity][
                        "mergedActivity"
                    ]
                    # print(activity, subject, day, startTime, endTime, campus, mergedActivity)
                    # Compare each class to all of the other classes to find classes to merge
                    for comparisonActivity in fullSchedule[student]["activities"]:
                        # Don't compare the activity if it's the same activity
                        if activity == comparisonActivity:
                            continue
                        # Don't compare the activity if it was already been merged
                        if mergedActivity == True:
                            continue
                        # Don't compare the comparison activity if it was aleady been merged
                        if (
                            fullSchedule[student]["activities"][comparisonActivity][
                                "mergedActivity"
                            ]
                            == True
                        ):
                            continue
                        # Extract the parameters from the oomparison activity
                        comparisonSubject = fullSchedule[student]["activities"][
                            comparisonActivity
                        ]["subject"]
                        comparisonDay = fullSchedule[student]["activities"][
                            comparisonActivity
                        ]["day"]
                        comparisonStartTime = fullSchedule[student]["activities"][
                            comparisonActivity
                        ]["startTime"]
                        comparisonEndTime = fullSchedule[student]["activities"][
                            comparisonActivity
                        ]["endTime"]
                        comparisonCampus = fullSchedule[student]["activities"][
                            comparisonActivity
                        ]["campus"]
                        # Check to see if the activities are the same class but on different days
                        if (
                            subject == comparisonSubject
                            and startTime == comparisonStartTime
                            and endTime == comparisonEndTime
                            and campus == comparisonCampus
                        ):
                            # print('----> Merge these activities: ', activity, day, comparisonActivity, comparisonDay)
                            # If they are the same class, update the day parameter in the activity and
                            # set the mergedActivity flag in the comparisonActivity to True so it's ignored
                            day = day + comparisonDay
                            day.sort()
                            # print(day)
                            fullSchedule[student]["activities"][activity]["day"] = day
                            fullSchedule[student]["activities"][comparisonActivity][
                                "mergedActivity"
                            ] = True
        except:
            print("===Error consolidating full schedule", sys.exc_info()[0])
            print("Exception in user code:")
            print("-" * 60)
            traceback.print_exc(file=sys.stdout)
            print("-" * 60)
            break

        try:
            # Export the fullSchedule Python dictionary into a CSV file
            csvFilename = output_file_path + "/" + "FetOutputFile.csv"
            csvOutputFile = open(csvFilename, "w")
            # Write header row for CSV file
            csvHeaderRow = "year,semester,Chatt_State_A_Number,CSname,firstName,lastName,HSclass,campus,courseNumber,courseName,sectionID,teacher,online,indStudy,days,times,startTime,endTime,comment\n"
            csvOutputFile.write(csvHeaderRow)
            csvOutputFileRowCount = 0
            # Extract class schedule info for CSV file
            for student in fullSchedule:
                chattStateANumber = student
                lastName = fullSchedule[student]["lastName"]
                firstName = fullSchedule[student]["firstName"]
                CSname = lastName + " " + firstName
                csvRowPrefix = [
                    schoolYear,
                    semester,
                    chattStateANumber,
                    CSname,
                    firstName,
                    lastName,
                    HSclass,
                ]
                for activity in fullSchedule[student]["activities"]:
                    if (
                        fullSchedule[student]["activities"][activity]["mergedActivity"]
                        == True
                    ):
                        continue
                    subject = fullSchedule[student]["activities"][activity]["subject"]

                    # Create ordered day string (e.g., MW, MWF, TR, etc...)
                    days = fullSchedule[student]["activities"][activity]["day"]
                    orderedDays = ""
                    for day in days:
                        orderedDays = orderedDays + day[1]
                    # print(orderedDays)

                    # Format times to include in CSV file
                    startTime = fullSchedule[student]["activities"][activity][
                        "startTime"
                    ]
                    endTime = fullSchedule[student]["activities"][activity]["endTime"]
                    startTimeAMPM = getTimeStringWithAMPM(startTime)
                    endTimeAMPM = getTimeStringWithAMPM(endTime)
                    # print(startTimeAMPM,endTimeAMPM)
                    startTime = getTimeStringWithoutAMPM(startTime)
                    endTime = getTimeStringWithoutAMPM(endTime)
                    times = startTime + " - " + endTime
                    # Include blanks for fields not included in FET file
                    courseNumber = ""
                    sectionID = ""
                    teacher = fullSchedule[student]["activities"][activity]["teacher"]
                    online = str(
                        fullSchedule[student]["activities"][activity]["online"]
                    )
                    indStudy = "0"
                    comments = fullSchedule[student]["activities"][activity]["comments"]

                    campus = fullSchedule[student]["activities"][activity]["campus"]
                    # Create row for CSV file by combining student info with class info
                    csvRow = csvRowPrefix + [
                        campus,
                        courseNumber,
                        subject,
                        sectionID,
                        teacher,
                        online,
                        indStudy,
                        orderedDays,
                        times,
                        startTimeAMPM,
                        endTimeAMPM,
                        comments,
                    ]
                    csvElementCounter = 1
                    for element in csvRow:
                        if csvElementCounter < len(csvRow):
                            csvOutputFile.write(element + ",")
                            csvElementCounter += 1
                        else:
                            csvOutputFile.write(element + "\n")
                    csvOutputFileRowCount = csvOutputFileRowCount + 1
        except:
            Print("===Error creating CSV file===", sys.exc_info()[0])
            break

        # Save the CSV file
        try:
            csvOutputFile.close()
            csvOutputFile = open(csvFilename, "r")
            print(csvOutputFile.read())
            csvOutputFile.close()
            print("CSV file saved to directory as", csvFilename)
        except:
            print("===Error saving CSV file===", sys.exc_info()[0])
            print("Exception in user code:")
            print("-" * 60)
            traceback.print_exc(file=sys.stdout)
            print("-" * 60)
            break

        # print(fullSchedule)

        # Update the formating of startTime and endTime to support JSON serialization
        try:

            for student in fullSchedule:
                for activity in fullSchedule[student]["activities"]:
                    startTime = fullSchedule[student]["activities"][activity][
                        "startTime"
                    ]
                    endTime = fullSchedule[student]["activities"][activity]["endTime"]
                    startTimeAMPM = getTimeStringWithAMPM(startTime)
                    endTimeAMPM = getTimeStringWithAMPM(endTime)
                    fullSchedule[student]["activities"][activity][
                        "startTime"
                    ] = startTimeAMPM
                    fullSchedule[student]["activities"][activity][
                        "endTime"
                    ] = endTimeAMPM

            jsonSchedule = json.dumps(fullSchedule, indent=4, separators=("", " = "))
            # print(jsonSchedule)
            jsonOutputFilename = output_file_path + "/" + "FetOutputFile.json"
            jsonOutputFile = open(jsonOutputFilename, "w")
            jsonOutputFile.write(jsonSchedule)
            jsonOutputFile.close()
            print("JSON file saved to directory as", jsonOutputFilename)
        except:
            print("===Error saving JSON file===", sys.exc_info()[0])
            print("Exception in user code:")
            print("-" * 60)
            traceback.print_exc(file=sys.stdout)
            print("-" * 60)
            break

        print(currentFetRow, "rows processed from FET timetable")
        print(activityCounter, "activities processed")
        print(csvOutputFileRowCount, "class rows included in CSV output file")

        print(
            """Important: The output file may require manual adjustments. For
        example, you may need to adjust class days or class times due to class
        scheduling conflicts.  These cases should be noted with a comment (e.g.,
        Miss W, Late W, etc.)  """
        )
        print("\n\n")
        print("=======================================")
        print("===   File Generation Complete      ===")
        print("===  ", datetime.now(), "   ===")
        print("=======================================")
        print("\n\n\n\n")
        run_program = False
        return
