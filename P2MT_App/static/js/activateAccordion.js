function activateSimpleAccordion(data_id) {
    var x = document.querySelectorAll("[data-identifier=" + data_id + "]");
    for (i = 0; i < x.length; i++) {
        if (x[i].style.visibility == "collapse") {
            x[i].style.visibility = "visible";
        } else {
            x[i].style.visibility = "collapse";
        }
    }
}

function activateAccordion(selectedRow, data_id, selectedRowHeaderColor = "w3-deep-orange", selectedRowDataColor = "w3-amber") {
    // Display or hide detail rows associated with selector rows
    //
    // Use these examples to define rows:
    //
    // Selector Rows:
    //   <tr class="w3-light-grey" style="visibility:visible;"
    //   onclick="activateAccordion(this,'accordion_{{studentTmiLog.id}}')" 
    //   data-rowType="selectorRow" data-identifier="accordion_{{studentTmiLog.id}}">
    //
    // Data Rows:
    //   <tr class="w3-amber w3-hover-grey" style="visibility:collapse;"
    //   onclick="activateAccordion(this,'accordion_{{studentTmiLog.id}}')"
    //   data-identifier="accordion_{{studentTmiLog.id}}">

    // Update color, fontWeight, and icon arrow for selected selectorRows
    // (as opposed to selected accordion data rows)
    // Change the color, font weight, arrow direction of the selected row to highlight it
    // If deselecting the row, set it to the default row color, font weight, arrow direction

    // console.log('selectedRow = ' + selectedRow)
    // console.log('Index Of ' + selectedRow.className.indexOf("w3-dark-grey"));
    if (selectedRow.getAttribute("data-rowType") == "selectorRow") {
        if (selectedRow.className.indexOf(selectedRowHeaderColor) == -1) {
            selectedRow.className = selectedRowHeaderColor;
            selectedRow.style.fontWeight = "bold";
            icon = selectedRow.querySelector('i');
            icon.className = "fa fa-caret-down fa-fw";
            // console.log('new color ' + selectedRow.className);
        } else {
            selectedRow.className = "w3-light-grey w3-hover-grey";
            selectedRow.style.fontWeight = "normal";
            icon = selectedRow.querySelector('i');
            icon.className = "fa fa-caret-right fa-fw";
            // console.log('new color ' + selectedRow.className);
        }
    }
    // Change all non-selected selectorRows to the default row color
    x = document.querySelectorAll("tr[data-rowType=selectorRow");
    for (i = 0; i < x.length; i++) {
        if (x[i] != selectedRow) {
            // console.log('selectorRow = ' + x[i])
            x[i].className = "w3-light-grey w3-hover-grey";
            x[i].style.fontWeight = "normal";
            icon = x[i].querySelector('i');
            icon.className = "fa fa-caret-right fa-fw";
            // console.log('Going grey');
        } else {
            // console.log('Selected row found');
        }
    }
    // Show the data rows associated with the selected row
    // Hide all data rows associated with non-selected rows
    var x = document.querySelectorAll("tr[data-identifier=" + data_id + "]");
    for (i = 0; i < x.length; i++) {
        if (x[i].hasAttribute('data-rowType')) {
            // console.log('ignore selector row');
        } else {
            if (x[i].style.visibility == "collapse") {
                x[i].style.visibility = "visible";
                x[i].className = selectedRowDataColor;
                // console.log('Setting data row to visible');
            } else {
                x[i].style.visibility = "collapse";
            }
        }
    }

    // Hide all rows which do not match the data row identifier and aren't selector rows
    // and change the arrow indicator to point right
    var x = document.querySelectorAll("tr:not([data-identifier=" + data_id + "])");
    // console.log('Number of non-data rows = ' + x.length);
    for (i = 0; i < x.length; i++) {
        if (x[i].hasAttribute('data-rowType')) {
            // console.log('ignore selector row');
        } else {
            if (x[i].style.visibility == "visible") {
                x[i].style.visibility = "collapse";
                // console.log('collapsing: ' + x[i]);
            }
        }
    }
}
