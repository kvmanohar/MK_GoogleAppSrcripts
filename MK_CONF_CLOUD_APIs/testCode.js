//Sampel code for testing
function sampelTextCode() {
	var mkConf = new MkConfluence('jiraCred.json');

	var resp = mkConf.getLastUpdatedPage('EN');
	Logger.log(JSON.stringify(resp));
}
