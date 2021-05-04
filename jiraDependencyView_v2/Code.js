//Global Variables
var baseUrl = 'https://ltmhedge.atlassian.net/issues/?jql=';
var jiraTokenFileName = 'jira_token.txt';
var ebiAccNum = '36033';
var ebiReportId = '372716';

var teamFieldValueMap = {
	'BB Journey': 'BB',
	'Corporate Core (CC)': 'CC',
	'Channels (CHAN)': 'CHAN',
	'Customer (CUS)': 'CUS',
	DATA: 'DATA',
	'Data (DATA)': 'DATA',
	'Front-Book Challenger': 'FC',
	'Fraud and Financial Crime (FAFC)': 'FAFC',
	'Migration Factory': 'MF',
	'Ops Management & Business Design': 'OMBD',
	'Payments (PAY)': 'PAY',
	'Platform Engineering': 'GPE',
	'Risk & Control (RIS)': 'RCQ1',
	'Smart Contracts & Workflows (SCW)': 'SCW',
	'Strong Customer Authentication (SCA)': 'SCA',
	'E+ Engineering': 'ENG'
};

// var projectCodes = {
// 	'BB Journey': 'BB',
// 	'Channels': 'CHAN',
// 	'Corporate Core': 'CC',
// 	'Customer': 'CUS',
// 	'Data': 'DATA',
// 	'E+ Integration Squad': 'E-INT',
// 	'E+ Programme': 'EP',
// 	'E+ Engineering': 'ENG',
// 	'Fraud and Financial Crime': 'FAFC',
// 	'Frontbook Challenger': 'FC',
// 	'Migration Factory': 'MF',
// 	'Risk & Control - Q1 2020': 'RCQ1',
// 	'E+ Security': 'ESEC',
// 	'Smart Contracts & Workflows': 'SCW',
// 	'Strong Customer Authentication': 'SCA',
// 	'Payments': 'PAY',
// 	'Platform Engineering': 'GPE'
// };

//Create a Route object
var Route = {};
Route.path = function (route, callback) {
	Route[route] = callback;
};

//Initial doGet function that Google Web App always calls.
function doGet(e) {
	Route.path('settings', loadSettings);
	Route.path('about', loadAbout);

	if (Route[e.parameters.v]) {
		return Route[e.parameters.v]();
	} else {
		return render('chart', { title: 'Endeavour+' });
	}
}

function loadSettings() {
	return render('settings', { title: 'Settings' });
}

function loadAbout() {
	return render('about', { title: 'About Us', bodyText: 'Some text here' });
}
