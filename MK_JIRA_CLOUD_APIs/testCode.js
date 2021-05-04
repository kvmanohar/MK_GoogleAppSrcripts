//Sampel code for testing
function sampelTextCode() {
	var mkjira = new MkJira('jiraCred.json');

	var resp = mkjira.createVersion(
		['BB', 'Data', 'CC', 'CUS', 'PAY', 'SCW', 'SCA', 'FAFC', 'ENG', 'GPE', 'MF', 'RCQ1', 'ESEC'],
		'Release 4.1',
		'Scope related to Technical Release 4.1'
	);

	Logger.log(JSON.stringify(resp));
}
