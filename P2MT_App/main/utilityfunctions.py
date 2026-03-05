import os
from flask import send_file, current_app
from datetime import datetime


def save_File(form_UploadedFileData, filename):
    file_path = os.path.join(current_app.root_path, "static/upload", filename)
    file_path = "/tmp" + "/" + filename
    form_UploadedFileData.save(file_path)
    return file_path


def download_File(filename):
    file_path = os.path.join(current_app.root_path, "static/uploadfiles", filename)
    file_path = "/tmp" + "/" + filename
    print("download_File function called with filename=", file_path)
    return send_file(file_path, as_attachment=True, cache_timeout=0)


def printLogEntry(logEntry):
    logtime = datetime.now().strftime("[%Y-%m-%d %H:%M:%S]  ")
    print(logtime, "***", logEntry, "***")
    return


def printFormErrors(form):
    if form.errors:
        printLogEntry("Form errors:" + str(form.errors))
    return


def createListOfDates(SchoolCalendarTableExtract):
    dateList = []
    for day in SchoolCalendarTableExtract:
        dateList.append(day.classDate)
    return dateList


def setToNoneIfEmptyString(parameter):
    if len(parameter) == 0:
        parameter = None
    return parameter


def parse_time_string(time_string):
    """Convert a time string use strptime function into a Python datetime type."""
    try:  # %I Hour (12-hour clock) as a zero-padded decimal number.	01, 02, ..., 12
        parsed_time = datetime.strptime(time_string.strip(), "%I:%M %p").time()
        print("%I:%M %p worked")
    except:
        try:  # %-I Hour (12-hour clock) as a decimal number.	1, 2, ... 12
            parsed_time = datetime.strptime(time_string.strip(), "%-I:%M %p").time()
            print("%-I:%M %p worked")
        except:
            try:  # %H Hour (24-hour clock) as a zero-padded decimal number.	00, 01, ..., 23
                parsed_time = datetime.strptime(time_string.strip(), "%H:%M %p").time()
                print("%H:%M %p worked")
            except:
                try:  # %-H Hour (24-hour clock) as a decimal number.	0, 1, ..., 23
                    parsed_time = datetime.strptime(
                        time_string.strip(), "%-H:%M %p"
                    ).time()

                    print("%-H worked")
                except:
                    try:  # %H Hour (24-hour clock) as a zero-padded decimal number.	00, 01, ..., 23
                        parsed_time = datetime.strptime(
                            time_string.strip(), "%H:%M"
                        ).time()
                        print("%H:%M worked")
                    except Exception as err:
                        raise err
    return parsed_time
