function ebiApi_getEazyBIData() {
	let jiraDetails = readTokenFile(jiraTokenFileName);

	var clientSecret = jiraDetails[0];
	var clientId = jiraDetails[1];

	let eBI_BaseUrl = 'https://aod.eazybi.com/accounts/' + ebiAccNum + '/export/report/' + ebiReportId + '.json';
	let authToken = Utilities.base64Encode(clientId + ':' + clientSecret);

	var options = {
		headers: {
			'Content-Type': 'application/json',
			Authorization: 'Basic ' + authToken
		}
	};

	try {
		// let response = UrlFetchApp.fetch(eBI_BaseUrl, options);
		// let json = response.getContentText();

		let json = readDataFromDrive('ebiData.txt');

		let data = JSON.parse(json);
		saveDataToDrive('ebiData.txt', JSON.stringify(data));
		let updDate = new Date(data.last_import_at);
		updDate.setHours(updDate.getHours() + 1);
		let updatedOn = updDate.toISOString().replace(/T/, ' ').replace(/\..+/, '');

		let agGridData = createAgGridData(data.query_results);
		let chartData = createChartData(agGridData);
		let inOutCounts = createInOutboundCounts(chartData);

		saveDataToDrive('agGridData.txt', JSON.stringify(agGridData));
		// saveDataToDrive('chartData.txt', JSON.stringify(chartData));
		// saveDataToDrive('inOutCounts.txt', JSON.stringify(inOutCounts));

		return { agGridData, chartData, inOutCounts, updatedOn };
	} catch (e) {
		Logger.log(e.message);
		return { error: e.message };
	}
}

function createAgGridData(ebiResp) {
	let agGridData = [];

	//Extract Column titles
	let colTitles = [];

	ebiResp.column_positions.map((val) => {
		let colHeader = val[0].name;
		colTitles.push(colHeader.replace('Issue ', ''));
	});

	//Extract data and values
	let issueArray = ebiResp.row_positions;
	let colValArray = ebiResp.values;
	issueArray.map((issue, rowIndex) => {
		let rowObj = {};
		let sIssue = issue[0];
		rowObj['Key'] = sIssue.key;
		rowObj['Summary'] = sIssue['name'].replace(sIssue.key + ' ', '');
		rowObj['To'] = sIssue['key'].split('-')[0]; //Project Key

		let issueValues = colValArray[rowIndex];
		colTitles.map((title, colIndex) => {
			if (title == 'Team') {
				let teamsArray = issueValues[colIndex].split(',');
				let newTeamFields = [];
				teamsArray.map((tm) => {
					newTeamFields.push(teamFieldValueMap.hasOwnProperty(tm) ? teamFieldValueMap[tm] : tm);
				});

				rowObj[title] = issueValues[colIndex];
				rowObj['From'] = newTeamFields.join(',');
			} else rowObj[title] = issueValues[colIndex];
		});

		agGridData.push(rowObj);
	});

	return agGridData;
}

function createChartData(agGridData) {
	//	let agGridData = JSON.parse(readDataFromFile('agGridData.txt'));
	let chartData = [];
	agGridData.map((issueRow) => {
		let teamName = issueRow['Team'].split(',');
		let fromNames = issueRow['From'].split(',');
		fromNames.map((frm, index) => {
			let chRow = chartData.find((val) => val['To'] == issueRow['To'] && val['From'] == frm);
			if (typeof chRow != 'undefined') chRow['Value'] += 1;
			else chartData.push({ To: issueRow.To, From: frm, Team: teamName[index], Value: 1 });
		});
	});

	//Add JQL for each of the chart data row
	chartData.map((cdata) => {
		let jql = 'type=Dependency AND resolution is EMPTY AND ';

		if (cdata['Team'] == '(none)') jql = jql + 'project in ("' + cdata['To'] + '") AND cf[10105] is EMPTY';
		else jql = jql + 'project in ("' + cdata['To'] + '") AND cf[10105] in ("' + cdata['Team'] + '")';

		cdata['JQL'] = jql;
	});

	return chartData;
}

function createInOutboundCounts(chartData) {
	let inOutCounts = [];
	chartData.map((dataRow) => {
		let currTo = dataRow['To'];
		let chkRow = inOutCounts.filter((val) => val['workstream'] == currTo);
		if (chkRow.length == 0) {
			let toArray = chartData.filter((row) => row['To'] == currTo);
			let totalInbound = 0;
			let totalOutboud = 0;
			toArray.map((row) => (totalInbound += row['Value']));
			let fromArray = chartData.filter((row) => row['From'] == currTo);
			if (fromArray.length > 0) fromArray.map((row) => (totalOutboud += row['Value']));
			inOutCounts.push({
				workstream: currTo,
				inbound: totalInbound,
				outbound: totalOutboud
			});
		}
	});
	return inOutCounts;
}
