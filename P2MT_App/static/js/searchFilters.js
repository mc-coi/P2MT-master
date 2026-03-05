// Filter items
function filterFirstLastNames(e) {
    // Description:
    // This function is intended to filter a first and last name cell in a row 
    // and only display rows that match the search text.
    // The search filter text input and the table body must be defined with an id tag.
    // Include this script by reference and call this function as shown in the example

    // Example:
    // <script type="text/javascript" src="{{ url_for('static', filename="js/searchFilters.js") }}"></script>
    // var tableBody = document.getElementById('filteredTable');
    // var searchFilter = document.getElementById('searchFilter');
    // searchFilter.firstNameCellPosition = 1;
    // searchFilter.lastNameCellPosition = 2;
    // searchFilter.addEventListener('keyup', filterFirstLastNames);

    firstNameCellPosition = e.target.firstNameCellPosition;
    lastNameCellPosition = e.target.lastNameCellPosition;
    // console.log("firstNameCellPosition = ", firstNameCellPosition);
    // console.log("lastNameCellPosition = ", lastNameCellPosition);
    // Convert search text to lowercase
    var searchText = e.target.value.toLowerCase();
    // Get all rows from the table body
    var tableRowsCollection = tableBody.getElementsByTagName('tr');
    // console.log("tableRows = " + tableRowsCollection);
    // Convert rows from HTML collect to an array
    var tableRows = Array.from(tableRowsCollection);
    // console.log("tableRows = " + tableRows);
    // console.log("number tableRows = " + tableRows.length);
    // Use for loop to search each row and each name cell
    for (var j = 0; j < tableRows.length; j++) {
        var tableCellsCollection = tableRows[j].getElementsByTagName('td');
        var tableCells = Array.from(tableCellsCollection);
        // console.log("tableCells = " + tableCells);
        // console.log("number tableCells = " + tableCells.length);
        if (tableCells.length != 0) {
            var firstName = tableCells[firstNameCellPosition].firstChild.textContent;
            var lastName = tableCells[lastNameCellPosition].firstChild.textContent;
            // console.log('firstName = ' + firstName + ' lastName = ' + lastName);
            // Check if the search text is found in the table data text
            if (firstName.toLowerCase().indexOf(searchText) != -1) {
                // console.log("Found a first name => " + firstName.toLowerCase());
                // Make the row visible if the search text is found
                tableRows[j].style.visibility = "visible";
            } else if (lastName.toLowerCase().indexOf(searchText) != -1) {
                // console.log("Found a last name => " + lastName.toLowerCase());
                // Make the row visible if the search text is found
                tableRows[j].style.visibility = "visible";
            } else {
                // Use visibility property to hide table elements and preserve formatting
                tableRows[j].style.visibility = "collapse";
            }
        }
    }
}

// Filter items
function filterRows(e) {
    // Description:
    // This function is intended to multiple adjacent cells in a row 
    // and only display rows that match the search text.
    // The search filter text input and the table body must be defined with an id tag.
    // Include this script by reference and call this function as shown in the example

    // Example:
    // <script type="text/javascript" src="{{ url_for('static', filename="js/searchFilters.js") }}"></script>
    // var tableBody = document.getElementById('filteredTable');
    // var searchFilter = document.getElementById('searchFilter');
    // searchFilter.startingCellPosition = 1;
    // searchFilter.endingCellPosition = 2;
    // searchFilter.addEventListener('keyup', filterFirstLastNames);

    // Important: these parameters must be defined on the event listener element
    startingCellPosition = e.target.startingCellPosition;
    endingCellPosition = e.target.endingCellPosition;
    console.log('updated called ' + startingCellPosition + endingCellPosition);
    // Convert search text to lowercase
    var searchText = e.target.value.toLowerCase();
    // Get all rows from the table body
    var tableRowsCollection = tableBody.getElementsByTagName('tr');
    // Convert rows from HTML collect to an array
    var tableRows = Array.from(tableRowsCollection);
    // Use for nested loops to search each row and each name table cell
    // Note: for loops are needed in order to use a break command
    // Note: Array...forEach does not support use of break command
    for (var j = 0; j < tableRows.length; j++) {
        var tableCellsCollection = tableRows[j].getElementsByTagName('td');
        var tableCells = Array.from(tableCellsCollection);
        for (var i = startingCellPosition; i <= endingCellPosition; i++) {
            // The cell names are found in index 1 and index 2
            // Prevent a case of a null value (which shouldn't be possible with name cells anyway)
            if (tableCells[i].firstChild) {
                // Pull the text value from the table data cell
                var tableData = tableCells[i].firstChild.textContent;
                // Check if the search text is found in the table data text
                if (tableData.toLowerCase().indexOf(searchText) != -1) {
                    // Make the row visible if the search text is found
                    tableRows[j].style.visibility = "visible";
                    // Break the loop and go on to the next row
                    // This break prevents the row from being hidden if the first name
                    // matches but the last name doesn't match
                    break;
                } else {
                    // Use visibility property to hide table elements and preserve formatting
                    tableRows[j].style.visibility = "collapse";
                }
            }
        }
    }
}