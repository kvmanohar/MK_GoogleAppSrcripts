/** Class for Atlassian Jira Apis wrapper */
class MkJira {
	/**
	 * Create Object with Jira access
	 * @param {String} jiraCred_filename Google Drive json file with Jira url, User id and Api token
	 */
	constructor(jiraCred_filename) {
		this.jiraCred = this.createApiDetails_(jiraCred_filename);
	}

	createApiDetails_(fileNameString) {
		try {
			let files = DriveApp.getFilesByName(fileNameString);
			if (files.hasNext()) {
				let contentText = files.next().getBlob().getDataAsString();
				let jiraCredJson = JSON.parse(contentText);
				let authString = Utilities.base64Encode(jiraCredJson.jiraUserId + ':' + jiraCredJson.jiraAPIkey);
				let htmlHeader = {
					'Content-Type': 'application/json',
					Authorization: 'Basic ' + authString
				};
				return {
					htmlHeader,
					baseUrl: jiraCredJson.baseUrl
				};
			} else {
				return { error: 'Token file not found' };
			}
		} catch (error) {
			return { error };
		}
	}

	/**
	 * GET ISSUES (max 10k per call) FROM JQL SEARCH RESULTS WITH THE RELATED FIELDS REQUESTED
	 * @param {String} jql JQL Search string
	 * @param {Array} extractFields	Fields to be extracted eg:['created', 'summary', 'status', 'customfield_10014']
	 * @param {Array} expandOptions	Jql exapand options eg: ['changelog']
	 *
	 * @return {Object} {issues: Array}
	 */

	getIssuesByJql(jql = 'project=TP', extractFields = ['issuetype', 'created', 'status'], expandOptions = []) {
		let apiDetails = this.jiraCred;

		// Number of parallel requests
		const MAX_PARALLEL_API_REQUESTS = 50;
		const ISSUES_PER_REQUEST = 100;

		// Limit the total number of issues from the filter to 10k
		const MAX_ISSUES = 10000;

		// Get baseUrl and apiDetials login Credential and build the API call params
		var jiraBaseUrl = apiDetails.baseUrl;
		var header = apiDetails.htmlHeader;

		// Build the Body of the Jira api request
		var body = {
			jql: jql,
			startAt: 0,
			maxResults: ISSUES_PER_REQUEST,
			fieldsByKeys: true,
			expand: expandOptions,
			fields: extractFields
		};

		var url = jiraBaseUrl + '/rest/api/3/search';
		var options = {
			method: 'POST',
			headers: header,
			payload: JSON.stringify(body)
		};

		//Fire the first API call to get the total number of issues in the JQL
		var response = UrlFetchApp.fetch(url, options);
		var data = JSON.parse(response.getContentText());

		var allIssuesJson = data.issues;
		var totalIssues = data.total;

		if (totalIssues > MAX_ISSUES)
			return { error: 'Crossed Max Issue limit of ' + MAX_ISSUES + '. total issues in JQL : ' + totalIssues };

		//Extract all issues in a loop if more than 100 issues returned by the JQL
		let totalApiCalls = Math.ceil(totalIssues / ISSUES_PER_REQUEST) - 1;
		let loopCnt = Math.ceil(totalApiCalls / MAX_PARALLEL_API_REQUESTS);

		var startAtCnt = ISSUES_PER_REQUEST;
		for (let i = 0; i < loopCnt; i++) {
			//Create array of request objects
			let reqOptions = [];
			for (let j = 0; i < MAX_PARALLEL_API_REQUESTS; j++) {
				if (startAtCnt <= totalIssues) {
					let reqObj = {};
					let bodyData = { ...body };
					bodyData.startAt = startAtCnt;

					startAtCnt += ISSUES_PER_REQUEST; // increment the startAt count for next iteration

					reqObj['url'] = url;
					reqObj['method'] = 'POST';
					reqObj['headers'] = header;
					reqObj['payload'] = JSON.stringify(bodyData);
					reqOptions.push(reqObj);
				} else break;
			}

			//Use FetchAll to fire all API requests.
			let resp = UrlFetchApp.fetchAll(reqOptions);
			let resIssues = resp.map((r) => JSON.parse(r.getContentText()).issues);
			let issuesJson = resIssues.reduce((allItems, item) => {
				allItems = [...allItems, ...item];
				return allItems;
			}, []);

			allIssuesJson = [...allIssuesJson, ...issuesJson];
		}

		return { issues: allIssuesJson };
	}

	/**
	 * GET LINKED ISSUES BASED ON THE LINK NAME
	 * @param {String}	key 	Jira issue key eg: 'TEST-1'
	 * @param {String}	linkName	Jira link name eg: 'is Blocked by'
	 * @param {Array | undefined}	extractFields	Fields to be extracted eg:['created', 'summary', 'status', 'customfield_10014'];
	 * @param {Array | undefined}	expandOptions	Jql exapand options eg: ['changelog'];
	 *
	 * @return {Object}	issuesArrayObject - {issues: Array}
	 *
	 * @throws              Error if  parameter
	 */
	getLinkedIssues(
		key = 'TP-1',
		linkName = 'is blocked by',
		extractFields = ['issuetype', 'created', 'status'],
		expandOptions = []
	) {
		var jql = `issue in linkedissues("${key}", "${linkName}")`;
		// jql = 'issue in linkedissues("TEST-1", "is blocked by")'

		var resp = this.getIssuesByJql(jql, extractFields, expandOptions);
		return resp;
	}

	/**
	 * UPDATE ISSUE FIELDS BY PASSING THE KEY AND FIELD INFO
	 * @param {String}  key - Jira issue key eg: 'TEST-1'
	 * @param {Object}  fields - fields to update in json format.
	 * 					eg: {
	 *							customfield_10065: ['12.1.0', '12.2.1.1', '12.3.1.1'],
	 *   						summary: "New Summary text"
	 *						}
	 *
	 *	@returns {String} response code : 204 - Update successful | 400 - Update failed
	 */
	updateIssue(key, fields) {
		let apiDetails = this.jiraCred;

		// Get Jira login Credential and build the API call params
		var jiraBaseUrl = apiDetails.baseUrl;
		var header = apiDetails.htmlHeader;

		// Build the Body of the Jira api request with the fields to update

		var body = { fields: fields };

		var url = jiraBaseUrl + '/rest/api/3/issue/' + key;
		var options = {
			method: 'PUT',
			headers: header,
			muteHttpExceptions: true,
			payload: JSON.stringify(body)
		};

		var response = UrlFetchApp.fetch(url, options);
		var respCode = response.getResponseCode();

		return respCode;
	}

	getProjectId(projectkey) {
		let apiDetails = this.jiraCred;

		// Get Jira login Credential and build the API call params
		var jiraBaseUrl = apiDetails.baseUrl;
		var header = apiDetails.htmlHeader;

		try {
			let url = `${jiraBaseUrl}/rest/api/3/project/${projectkey}`;
			let respJson = JSON.parse(UrlFetchApp.fetch(url, { headers: header, muteHttpExceptions: true }).getContentText());
			return respJson;
		} catch (error) {
			Logger.log(JSON.stringify(error));
			return error;
		}
	}

	/**
	 * Create new versions in the projects
	 *
	 * @param {Array} projectKeys
	 * @param {String} name
	 * @param {String} description
	 * @param {Date} releaseDate
	 * @param {Boolean} archived
	 * @param {Boolean} released
	 */
	createVersion(
		projectKeys = [],
		name = 'TEST Version',
		description = '',
		releaseDate = null,
		archived = false,
		released = false
	) {
		let apiDetails = this.jiraCred;

		// Get Jira login Credential and build the API call params
		var jiraBaseUrl = apiDetails.baseUrl;
		var header = apiDetails.htmlHeader;

		var outputStatus = [];
		projectKeys.map((key) => {
			// Build the Body of the Jira api request with the fields to update

			let { id } = this.getProjectId(key);

			var body = {
				archived,
				released,
				description,
				name,
				releaseDate,
				projectId: id
			};

			var url = jiraBaseUrl + '/rest/api/3/version/';
			var options = {
				method: 'POST',
				headers: header,
				muteHttpExceptions: true,
				payload: JSON.stringify(body)
			};

			var response = UrlFetchApp.fetch(url, options);
			var respJson = response.getContentText();

			outputStatus.push({ [key]: respJson });
		});

		return outputStatus;
	}

	/**
	 * UPDATE VERSION BY ID - NEED TO KNOW THE VERSION ID
	 * @param {String} id	Version ID which can be found in the url when the version is selected Jira. Eg: '11007'
	 * @param {*} updateDetails JSON object with all optional attributes 'name', 'description', 'releaseDate', 'startDate', 'archived', 'released'.
	 * 							Eg: {name: 'New Name Version', startDate:'2021-05-31', released: false}
	 */
	updateVersionById(
		id = '0000',
		updateDetails = {
			name: 'TEST Version',
			description: '',
			releaseDate: null,
			startDate: null,
			archived: false,
			released: false
		}
	) {
		let apiDetails = this.jiraCred;

		// Get Jira login Credential and build the API call params
		var jiraBaseUrl = apiDetails.baseUrl;
		var header = apiDetails.htmlHeader;

		var url = jiraBaseUrl + '/rest/api/3/version/' + id;
		var options = {
			method: 'PUT',
			headers: header,
			muteHttpExceptions: true,
			payload: JSON.stringify(updateDetails)
		};

		var respJson = UrlFetchApp.fetch(url, options).getContentText();
		return respJson;
	}

	/**
	 * GET ALL VERSIONS OF THE PROJECT
	 * @param {String} projectKey Jira project key Eg: TP
	 */
	getProjectVersions(projectKey = null) {
		if (projectKey == null) return [];

		let apiDetails = this.jiraCred;
		var jiraBaseUrl = apiDetails.baseUrl;
		var header = apiDetails.htmlHeader;
		try {
			let url = `${jiraBaseUrl}/rest/api/3/project/${projectKey}/versions`;
			let respJson = JSON.parse(UrlFetchApp.fetch(url, { headers: header, muteHttpExceptions: true }).getContentText());
			return respJson;
		} catch (error) {
			Logger.log(JSON.stringify(error));
			return error;
		}
	}

	/**
	 * GET THE VERSION ID FROM VERSION NAME
	 * @param {String} projectKey Jira Project Key eg: 'TP'
	 * @param {String} versionName Version name string Eg: 'Release 1'
	 */
	getVersionId(projectKey = null, versionName = '') {
		if (projectKey == null) return null;

		let id = null;
		let allVersions = this.getProjectVersions(projectKey);
		if (allVersions.length > 0) {
			let version = allVersions.filter((v) => v.name == versionName);
			id = version.length > 0 ? version[0].id : null;
		}
		return id;
	}

	/**
	 * GET all Jira projects (max 1000 )
	 * @param {String} jql JQL Search string
	 * @param {Array} expand Details to expand eg:['description', 'projectKeys', 'lead', 'issueTypes','url','insight']
	 *
	 * @return {Object} {issues: Array}
	 */
	getAllProjects(expand = ['lead', 'insight']) {
		let apiDetails = this.jiraCred;

		// Number of parallel requests
		const MAX_PARALLEL_API_REQUESTS = 50;
		const PROJECTS_PRE_REQUEST = 50;

		// Limit the total number of issues from the filter to 10k
		const MAX_PROJECTS = 500;

		// Get baseUrl and apiDetials login Credential and build the API call params
		var jiraBaseUrl = apiDetails.baseUrl;
		var header = apiDetails.htmlHeader;

		//Build the URL
		var startAt = 0;
		var url = jiraBaseUrl + `/rest/api/3/project/search?startAt=${startAt}&expand=${expand.join(',')}`;

		//Fire the first API call to get the total number of issues in the JQL
		var data = JSON.parse(UrlFetchApp.fetch(url, { headers: header, muteHttpExceptions: true }).getContentText());

		var allProjectsJson = data.values;
		var totalProjects = data.total;

		if (totalProjects > MAX_PROJECTS)
			return { error: 'Crossed Max Issue limit of ' + MAX_PROJECTS + '. total issues in JQL : ' + totalProjects };

		//Extract all issues in a loop if more than 100 issues returned by the JQL
		let totalApiCalls = Math.ceil(totalProjects / PROJECTS_PRE_REQUEST) - 1;
		let loopCnt = Math.ceil(totalApiCalls / MAX_PARALLEL_API_REQUESTS);

		var startAtCnt = PROJECTS_PRE_REQUEST;
		for (let i = 0; i < loopCnt; i++) {
			//Create array of request objects
			let reqOptions = [];
			for (let j = 0; i < MAX_PARALLEL_API_REQUESTS; j++) {
				if (startAtCnt <= totalProjects) {
					let reqObj = {};
					var url = jiraBaseUrl + `/rest/api/3/project/search?startAt=${startAtCnt}&expand=${expand.join(',')}`;
					startAtCnt += PROJECTS_PRE_REQUEST; // increment the startAt count for next iteration
					reqObj['url'] = url;
					reqObj['method'] = 'GET';
					reqObj['headers'] = header;
					reqOptions.push(reqObj);
				} else break;
			}

			//Use FetchAll to fire all API requests.
			let resp = UrlFetchApp.fetchAll(reqOptions);
			let resProjects = resp.map((r) => JSON.parse(r.getContentText()).values);
			let projectsJson = resProjects.reduce((allItems, item) => {
				allItems = [...allItems, ...item];
				return allItems;
			}, []);

			allProjectsJson = [...allProjectsJson, ...projectsJson];
		}

		return { values: allProjectsJson };
	}

	/**
	 * GET ALL WORKFLOW STATUS OF THE JIRA INSTANSE
	 */
	getAllStatus() {
		let apiDetails = this.jiraCred;

		// Get Jira login Credential and build the API call params
		var jiraBaseUrl = apiDetails.baseUrl;
		var header = apiDetails.htmlHeader;

		try {
			let url = `${jiraBaseUrl}/rest/api/2/status`;
			let respJson = JSON.parse(UrlFetchApp.fetch(url, { headers: header, muteHttpExceptions: true }).getContentText());
			return respJson;
		} catch (error) {
			Logger.log(JSON.stringify(error));
			return error;
		}
	}

	/**
	 * GET EAZY-BI REPORT IN JSON or CSV FORMAT
	 * @param {String} eBI_AccNum  - EazyBI Account number
	 * @param {String} eBI_ReportId - EazyBI Report id
	 * @param {String} opFormat - Response format json (defaul) or csv. Eg: 'csv'
	 */
	getEazyBIReport(eBI_AccNum = '0000', eBI_ReportId = '0000', opFormat = 'json') {
		let apiDetails = this.jiraCred;
		var header = apiDetails.htmlHeader;
		opFormat = opFormat.toLowerCase();

		let eBI_BaseUrl = `https://aod.eazybi.com/accounts/${eBI_AccNum}/export/report/${eBI_ReportId}.${opFormat}`;

		try {
			let resp = UrlFetchApp.fetch(eBI_BaseUrl, { headers: header, muteHttpExceptions: true }).getContentText();
			let data = opFormat == 'json' ? JSON.parse(resp) : resp;
			return { data };
		} catch (error) {
			return { error };
		}
	}

	/** TODO: Draft
	 * BULK UPDATE ISSUES - THIS METHOD UPDATES 50 ISSUES AT A TIME USING THE FETCH ALL FETAURE OF APP SCRIPTS
	 * @param {Array}	issueKeyAndFields	- Object array of key value pair of issue key and fields to update
	 *
	 *	Eg: [
	 *		{key: 'TP-09', fields:{ customfield_10065: 'Text field update value'}},
	 *		{key: 'TP-10', fields:{ summary: 'Update summary field', customfield_10005: 'Test value'}},
	 *	]
	 */

	bulkUpdateIssues_({ issueKeyAndFields = [] }) {
		let apiDetails = this.jiraCred;
		var jiraBaseUrl = apiDetails.baseUrl;
		var header = apiDetails.htmlHeader;

		//build the multiple Fetch calls array
		const MAX_PARALLEL_API_REQUESTS = 50;
		const MAX_ISSUES = 5000;

		var totalIssues = issueKeyAndFields.length;
		if (totalIssues == 0) return { error: 'No issues to update' };
		if (totalIssues > MAX_ISSUES) return { error: `Total Issue count > ${MAX_ISSUES}` };

		let loopCnt = Math.ceil(totalIssues / MAX_PARALLEL_API_REQUESTS);
		var currIndex = 0;
		var allRespCodes = [];
		for (let i = 0; i < loopCnt; i++) {
			//Create array of request objects (MAX 50)
			let reqOptions = [];
			for (let j = 0; j < MAX_PARALLEL_API_REQUESTS; j++) {
				if (currIndex < totalIssues) {
					let currIssue = issueKeyAndFields[currIndex];
					let issueKey = currIssue.hasOwnProperty('key') ? currIssue['key'] : 'TP-00';
					let fields = currIssue.hasOwnProperty('fields') ? currIssue['fields'] : {};

					let reqObj = {};
					reqObj['url'] = jiraBaseUrl + '/rest/api/3/issue/' + issueKey;
					reqObj['method'] = 'PUT';
					reqObj['headers'] = header;
					reqObj['payload'] = JSON.stringify({ fields: fields });
					reqOptions.push(reqObj);

					currIndex += 1;
				} else break;
			}

			//Use FetchAll to fire all API requests.
			let resp = UrlFetchApp.fetchAll(reqOptions);
			let respCodes = resp.map((r) => r.getResponseCode());
			allRespCodes = [...allRespCodes, ...respCodes];
		}
	}
}

/* Globally accessible factory method */
function createMkjira(filename = 'jiraCred.json') {
	return new MkJira(filename);
}
