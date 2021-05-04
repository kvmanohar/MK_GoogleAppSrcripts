var cols = {};

function mkStructure() {
	var ss = SpreadsheetApp.getActiveSpreadsheet();
	var ipSheet = ss.getSheetByName('Input');
	var opSheet = ss.getSheetByName('Structure');

	createStructure(ipSheet, opSheet);
}

function createStructure(ipSheet, opSheet) {
	var range = ipSheet.getDataRange();
	var allIssues = range.getValues();

	//Column header index object
	let headerRow = ipSheet.getRange(1, 1, 1, ipSheet.getLastColumn()).getValues()[0];
	headerRow.map((val, index) => {
		cols[val] = index;
	});

	// Clear output Worksheet
	if (opSheet.getFilter() !== null) opSheet.getFilter().remove(); // Remove filters if already exists
	opSheet.clearContents(); //Clear existing content

	let opRange = opSheet.getRange(1, 1, 1, headerRow.length);
	opRange.setValues([headerRow]);

	//Filter Starting parent rows issueType=Capability
	var filterRows = allIssues.filter((r) => r[cols['Issue Type']] === 'Capability');

	filterRows.map((row) => {
		getLinkedIssues(allIssues, row, opSheet);
	});

	return;
}

function getLinkedIssues(allIssues, issue, opSheet) {
	let linkName = '';
	let linkedRows = [];

	writeIssueToSheet([issue], opSheet);
	switch (issue[cols['Issue Type']]) {
		case 'Capability':
			linkName = 'Capability Is delivered by Epic';
			let issuLinkJSON = JSON.parse(issue[cols['Linked Issues']]);
			let linkIssKeys = issuLinkJSON.hasOwnProperty(linkName) ? issuLinkJSON[linkName] : [];
			if (linkIssKeys.length > 0) {
				linkIssKeys.map((key) => linkedRows.push(...allIssues.filter((r) => r[cols['Key']] === key)));
				linkedRows.map((row) => getLinkedIssues(allIssues, row, opSheet));
			}
			break;

		case 'Epic':
			linkedRows = [...allIssues.filter((r) => r[cols['Epic Link']] === issue[cols['Key']])];
			if (linkedRows.length > 0) writeIssueToSheet(linkedRows, opSheet);
			break;
		default:
			break;
	}
	return;
}

function writeIssueToSheet(opIssues, opSheet) {
	let opDataRange = opSheet.getRange(opSheet.getLastRow() + 1, 1, opIssues.length, opIssues[0].length);
	opDataRange.setValues(opIssues);
	return;
}

//function MKGroupTest() {
//	var spreadsheet = SpreadsheetApp.getActive();
//	var sheet = spreadsheet.getActiveSheet();
//	sheet
//		.getRange(spreadsheet.getCurrentCell().getRow() - 1, 1, 6, sheet.getMaxColumns())
//		.activate()
//		.shiftRowGroupDepth(1);
//	sheet = spreadsheet.getActiveSheet();
//	sheet
//		.getRange(spreadsheet.getCurrentCell().getRow() + 1, 1, 4, sheet.getMaxColumns())
//		.activate()
//		.shiftRowGroupDepth(1);
//}
