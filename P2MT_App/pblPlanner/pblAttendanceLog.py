from P2MT_App import db
from P2MT_App.models import ClassSchedule, ClassAttendanceLog, PblEvents
from P2MT_App.main.utilityfunctions import printLogEntry
from P2MT_App.pblPlanner.pblEmailer import getPblCommunicationsRecipients


def updatePblEventCommentOnAttendanceLogs(
    className,
    academicYear,
    quarter,
    emailRecipients,
    selectedEmailRecipients,
    pblCommunicationsActions,
):
    printLogEntry("Running uppdatePblEventCommentOnAttendanceLogs()")

    pblTeamRecipients = getPblCommunicationsRecipients(
        className, academicYear, quarter, emailRecipients, selectedEmailRecipients,
    )
    for pblTeamMember in pblTeamRecipients:
        print(
            "Update attendance log for:",
            pblTeamMember.Student.firstName,
            pblTeamMember.Student.lastName,
        )

        if pblTeamMember.Pbls:

            pblName = pblTeamMember.Pbls.pblName
            # Get event details
            if pblCommunicationsActions == -1:
                # get kickoff event details
                event = PblEvents.query.filter(
                    PblEvents.pbl_id == pblTeamMember.pbl_id,
                    PblEvents.eventCategory == "Kickoff",
                ).first()
            if pblCommunicationsActions == -2:
                # get final presentation event details
                event = PblEvents.query.filter(
                    PblEvents.pbl_id == pblTeamMember.pbl_id,
                    PblEvents.eventCategory == "Final",
                ).first()
            attendanceLogs = (
                ClassAttendanceLog.query.join(ClassSchedule)
                .filter(
                    ClassAttendanceLog.classDate == event.eventDate,
                    ClassSchedule.chattStateANumber == pblTeamMember.chattStateANumber,
                )
                .all()
            )
            scheduleComment = f"[PBL {event.eventCategory}: {event.startTime:%-I:%M}-{event.endTime:%-I:%M} {pblName} ] "
            for attendanceLog in attendanceLogs:
                if attendanceLog.comment == None:
                    attendanceLog.comment = ""
                attendanceLog.comment = scheduleComment + attendanceLog.comment
                print(
                    f"Attendance Comment for {attendanceLog.ClassSchedule.className}: {attendanceLog.comment}"
                )
    return

