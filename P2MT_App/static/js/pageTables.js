// Tabs for tables
// Based on example here: https://www.w3schools.com/w3css/w3css_tabulators.asp
// Requires HTML elements defined as in these examples:
// 
// <div class="w3-bar w3-blue">
// <button id='button_StudentInfoTab' class="w3-bar-item w3-button tablink w3-black" onclick="openTab(event, 'StudentInfoTab', 'ScheduleAdmin')">StudentInfo</button>
// <button id='button_StaffInfoTab' class="w3-bar-item w3-button tablink" onclick="openTab(event, 'StaffInfoTab', 'ScheduleAdmin')">Staff Info</button></div>
// 
// <tr class="infoTab" id="StudentInfoTab">
// <tr class="infoTab" id="StaffInfoTab" style="visibility:collapse">
// 

function openTable(evt, infoTabName, pageName) {
    page_selected_tab = pageName + '_selected_tab';
    sessionStorage.setItem(page_selected_tab, infoTabName);
    var i, x, tablinks;

    infoRows = document.querySelectorAll("tr[data-rowType=infoTab]");
    // console.log('infoRows length=' + infoRows.length);
    for (i = 0; i < infoRows.length; i++) {
        infoRows[i].style.visibility = "collapse";
    }
    tablinks = document.querySelectorAll("button[class~=tablink]");
    // console.log('tablinks length=' + tablinks.length);
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" w3-black", "");
    }
    infoRows = document.querySelectorAll("tr[data-tabName=" + infoTabName + "]");
    for (i = 0; i < infoRows.length; i++) {
        infoRows[i].style.visibility = "visible";
    }
    evt.currentTarget.className += " w3-black";
}
