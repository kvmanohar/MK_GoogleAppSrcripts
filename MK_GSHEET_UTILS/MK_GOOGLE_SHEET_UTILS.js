function addArrayToSheetColumn(wSheet, columnChar, valuesArray) {
	const range = [columnChar, '2:', columnChar, valuesArray.length + 1].join('');
	wSheet.getRange(range).setValues(valuesArray.map((v) => [v]));
}

function readSheetColumnToArray(wSheet, columnChar) {
	const range = [columnChar, '2:', columnChar, wSheet.getLastRow() - 1].join('');
	var colData = wSheet
		.getRange(range)
		.getValues()
		.map((v) => v[0]);

	return colData;
}

function clearSheetData(wSheet, excludeHeaderRow) {
	// Remove filters if already exists
	if (wSheet.getFilter() !== null) wSheet.getFilter().remove();

	if (excludeHeaderRow) wSheet.getRange(2, 1, wSheet.getMaxRows() - 1, wSheet.getMaxColumns()).clearContent();
	else wSheet.clearContents();
}

function deleteSheetRows(wSheet) {
	var startRow, howManyToDelete;

	startRow = 2;
	howManyToDelete = wSheet.getMaxRows() - startRow; //How many rows to delete
	wSheet.deleteRows(startRow, howManyToDelete);
}

//Move array of data rows into workstheet
function moveRowsArrayToSheet(wSheet, opRows) {
	if (opRows.length) {
		wSheet.getRange(1, 1, opRows.length, opRows[0].length).setValues(opRows);
	}
	return true;
}
