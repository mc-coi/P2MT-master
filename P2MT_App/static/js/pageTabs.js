// Tabs for pages
// Based on example here: https://www.w3schools.com/w3css/w3css_tabulators.asp
// Requires HTML elements defined as in these examples:
// 
// <div class="w3-bar w3-blue">
// <button id='button_StudentInfoTab' class="w3-bar-item w3-button tablink w3-black" onclick="openTab(event, 'StudentInfoTab', 'ScheduleAdmin')">StudentInfo</button>
// <button id='button_StaffInfoTab' class="w3-bar-item w3-button tablink" onclick="openTab(event, 'StaffInfoTab', 'ScheduleAdmin')">Staff Info</button></div>
// 
// <div class="infoTab" id="StudentInfoTab">
// <div class="infoTab" id="StaffInfoTab" style="display:none">
// 

function openTab(evt, infoTabName, pageName) {
    page_selected_tab = pageName + '_selected_tab';
    sessionStorage.setItem(page_selected_tab, infoTabName);
    var i, x, tablinks;

    x = document.getElementsByClassName("infoTab");
    for (i = 0; i < x.length; i++) {
        x[i].style.display = "none";
    }
    tablinks = document.getElementsByClassName("tablink");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" w3-black", "");
    }
    document.getElementById(infoTabName).style.display = "block";
    evt.currentTarget.className += " w3-black";
}