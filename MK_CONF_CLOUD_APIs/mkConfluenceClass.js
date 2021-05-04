class MkConfluence {
	/**
	 * Create Object with Confluence access
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
	 * GET THE DETAILS OF THE CURRENT LOGGED IN CONFLUENCE USER
	 * @returns {object} With the User details
	 */
	getCurrentUser() {
		var apiDetails = this.jiraCred;
		var baseUrl = apiDetails.baseUrl;
		var header = apiDetails.htmlHeader;
		try {
			let url = `${baseUrl}/wiki/rest/api/user/current`;
			let respJson = JSON.parse(UrlFetchApp.fetch(url, { headers: header, muteHttpExceptions: true }).getContentText());
			return respJson;
		} catch (error) {
			Logger.log(JSON.stringify(error));
			return error;
		}
	}

	/**
	 * GET CONFLUENCE CONTENT BY PASSING CQL (MAX 1000 PAGES RESTRICTION)
	 * @param {String} cql CQL string to search confluence space
	 * @param {Array | undefined} expandOptions Field to be extracted. eg: ['version', 'metadata.labels']
	 *
	 * @returns {Object} Return {results: <Array>} if successfull. On error return error Object {error : errorObject}
	 */
	getContentByCql(cql = 'type=page', expandOptions = ['metadata.labels'], pageLimit = 0) {
		var apiDetails = this.jiraCred;
		var baseUrl = apiDetails.baseUrl;
		var header = apiDetails.htmlHeader;
		const LIMIT = 50;

		var limitPages = pageLimit > 0 ? true : false;
		var results = [];

		try {
			let expOptStr = expandOptions.join(',');
			cql = encodeURIComponent(cql);
			let url = `${baseUrl}/wiki/rest/api/content/search?cql=${cql}&expand=${expOptStr}&limit=${LIMIT}`;
			var respJson = JSON.parse(UrlFetchApp.fetch(url, { headers: header, muteHttpExceptions: true }).getContentText());

			if (respJson.hasOwnProperty('results')) {
				results = [...results, ...respJson.results];
				while (respJson._links.next && (!limitPages || pageLimit > results.length) && results.length < 1000) {
					let nextUrl = `${respJson._links.base}${respJson._links.next}`;
					respJson = JSON.parse(
						UrlFetchApp.fetch(nextUrl, { headers: header, muteHttpExceptions: true }).getContentText()
					);
					if (respJson.hasOwnProperty('results')) results = [...results, ...respJson.results];
				}
			}
			if (pageLimit > 0) results = results.slice(0, pageLimit); //Limit output pages if pagelimit given

			return { results };
		} catch (error) {
			Logger.log(JSON.stringify(error));
			return { error };
		}
	}

	/**
	 * GET CONTENT OF THE CONFLUENCE PAGE
	 * @param {String} pageId Confluence page id
	 * @param {Array | undefined} expandOptions Field to be extracted. eg: ['version', 'metadata.labels']
	 */
	getContentByPageId(pageId = '0000', expandOptions = ['metadata.labels']) {
		var apiDetails = this.jiraCred;
		var baseUrl = apiDetails.baseUrl;
		var header = apiDetails.htmlHeader;

		try {
			let expandOptionString = expandOptions.join(',');
			let url = `${baseUrl}/wiki/rest/api/content/${pageId}?expand=${expandOptionString}`;
			let respJson = JSON.parse(UrlFetchApp.fetch(url, { headers: header, muteHttpExceptions: true }).getContentText());
			return respJson;
		} catch (error) {
			Logger.log(JSON.stringify(error));
			return error;
		}
	}

	/**
	 * UPDATE THE CONTENT OF THE CONFLUENCE PAGE
	 * @param {String} pageId Page id to be updated
	 * @param {String} bodyHtmlData Html string of body date in 'body.storage' format.
	 * @param {String} title Only provide if page title need to be changed.
	 */
	updateContentByPageId(pageId = '0000', bodyHtmlData, title = null) {
		var apiDetails = this.jiraCred;
		var baseUrl = apiDetails.baseUrl;
		var header = apiDetails.htmlHeader;

		try {
			//Get next version of the page.
			let resp = this.getContentByPageId(pageId, ['version']);
			var newVersion = 0;
			if (resp.version) {
				newVersion = resp.version.number + 1;
				title = title == null ? resp.title : title;

				//Update the page with the new bodyHtmlData passed.
				let url = `${baseUrl}/wiki/rest/api/content/${pageId}`;
				let bodyData = {
					version: {
						number: newVersion
					},
					type: 'page',
					title: title,
					status: 'current',
					body: {
						storage: {
							value: bodyHtmlData,
							representation: 'storage'
						}
					}
				};
				var requestOptions = {
					method: 'PUT',
					headers: header,
					muteHttpExceptions: true,
					payload: JSON.stringify(bodyData)
				};

				var response = UrlFetchApp.fetch(url, requestOptions);
				var data = JSON.parse(response.getContentText());
				return data;
			} else throw { error: 'Page not found!' };
		} catch (error) {
			Logger.log(JSON.stringify(error));
			return error;
		}
	}

	/**
	 * GET CONTENT DESCENDANT PAGES NO LIMIT
	 * @param {String}	pageId - Page id
	 * @param {Array | undefined}	expandOptions	- Fields to be extracted eg:['version', 'metadata.labels'];
	 *
	 * @return {Object}	descendant page array
	 *
	 * @throws   Error if  parameter
	 *
	 */
	getContentDescendants(pageId = '000000', expandOptions = ['version']) {
		var apiDetails = this.jiraCred;
		var baseUrl = apiDetails.baseUrl;
		var header = apiDetails.htmlHeader;

		var results = [];

		try {
			let expandOptionString = expandOptions.join(',');
			let url = `${baseUrl}/wiki/rest/api/content/${pageId}/descendant/page?limit=200&expand=${expandOptionString}`;
			let respJson = JSON.parse(UrlFetchApp.fetch(url, { headers: header, muteHttpExceptions: true }).getContentText());

			if (respJson.hasOwnProperty('results')) {
				results = [...results, ...respJson.results];
				while (respJson._links.next) {
					let nextUrl = `${respJson._links.base}${respJson._links.next}`;
					respJson = JSON.parse(
						UrlFetchApp.fetch(nextUrl, { headers: header, muteHttpExceptions: true }).getContentText()
					);
					if (respJson.hasOwnProperty('results')) results = [...results, ...respJson.results];
				}
			}
			return { results };
		} catch (error) {
			Logger.log(JSON.stringify(error));
			return error;
		}
	}

	/**
	 * GET PAGE MACRO BODY
	 * @param {String}	pageId Eg: 231923
	 * @param {Number}  version Eg: 10
	 * @param {String}	macroId	Eg: '83723-cdfb-2323ed'
	 *
	 * @return {String}	macro body string.
	 *
	 * @throws   Error if  parameter
	 *
	 */
	getPageMacroBody(pageId = '00000', version = 1, macroId = '83723-cdfb-2323ed') {
		let apiDetails = this.jiraCred;

		var baseUrl = apiDetails.baseUrl;
		var header = apiDetails.htmlHeader;

		try {
			//https://ltmhedge.atlassian.net/wiki/rest/api/content/835191355/history/11/macro/id/cdbbfa8e-e00a-4380-8237-99238290c2f5
			let url = `${baseUrl}/wiki/rest/api/content/${pageId}/history/${version}/macro/id/${macroId}`;

			let resp = UrlFetchApp.fetch(url, { headers: header, muteHttpExceptions: true }).getContentText();
			let respJson = JSON.parse(resp);

			if (respJson.hasOwnProperty('body')) return respJson['body'];
			else return null;
		} catch (error) {
			Logger.log(JSON.stringify(error));
			return JSON.stringify(error);
		}
	}

	/**
	 * ADD LABEL TO CONFLUENCE PAGE
	 * @param {String} pageId	id of the confluence page Eg: '121347329'.
	 * @param {Array} labels	String array of labels to be added Eg: ['label1','label2'].
	 */
	addLabelToPage(pageId = '00000', labels = ['label1', 'label2']) {
		let apiDetails = this.jiraCred;

		var baseUrl = apiDetails.baseUrl;
		var header = apiDetails.htmlHeader;

		try {
			//https://ltmhedge.atlassian.net/wiki/rest/api/content/835191355/label
			var url = `${baseUrl}/wiki/rest/api/content/${pageId}/label`;
			var bodyData = labels.map((label) => {
				return { prefix: 'global', name: label };
			});

			var requestOptions = {
				method: 'POST',
				headers: header,
				payload: JSON.stringify(bodyData)
			};

			var response = UrlFetchApp.fetch(url, requestOptions);
			var data = JSON.parse(response.getContentText());

			return data;
		} catch (error) {
			Logger.log(JSON.stringify(error));
			return error;
		}
	}

	/**
	 * ADD LABELS TO ALL DECENDANT (MAX 350) PAGES OF THE PAGE ID
	 * @param {String} pageId	Page id of the parent page Eg: '121347329'.
	 * @param {Array} labels 	String arrya of labels to be added to the decendant pages Eg: ['label1','label2'].
	 *
	 * @returns {Object} array of objects with page ids and results. Eg: [{pageId: '12121', result:'Labels added successfully'}]
	 */
	addLabelsToAllDecendants(pageId = '00000', labels = ['label1']) {
		let apiDetails = this.jiraCred;
		const MAX_DESCENDANTS = 350;

		var respJson = this.getContentDescendants(pageId);
		var decendantPages = respJson.hasOwnProperty('results') ? respJson['results'] : [];

		if (decendantPages.length > MAX_DESCENDANTS) return { error: `Decendant pages greater than ${MAX_DESCENDANTS}` };

		var results = [];
		decendantPages.map((dPage) => {
			var pId = dPage['id'];
			var resp = this.addLabelToPage(pId, labels);
			if (resp.hasOwnProperty('results')) {
				results.push({
					pageId: pId,
					result: 'Labels added successfully'
				});
			} else {
				results.push({
					pageId: pId,
					result: resp.message
				});
			}
		});
		return results;
	}

	/**
	 * DELETE LABEL FROM THE PAGE
	 * @param {String} pageId Page id of the page to delete the label from.
	 * @param {String} label Label string that need to be deleted.
	 *
	 * @returns {String} '204' - Label successfully deleted
	 * 				 '403' - User have no edit access to the page.
	 * 				 '404' - Page not found or user have no read access to the page.
	 */
	deleteLabelFromPage(pageId = '0000', label = 'label1') {
		let apiDetails = this.jiraCred;

		var baseUrl = apiDetails.baseUrl;
		var header = apiDetails.htmlHeader;

		//https://ltmhedge.atlassian.net/wiki/rest/api/content/835191355/label?name={name}
		var url = `${baseUrl}/wiki/rest/api/content/${pageId}/label?name=${label}`;
		var requestOptions = {
			method: 'DELETE',
			muteHttpExceptions: true,
			headers: header
		};

		var resp = UrlFetchApp.fetch(url, requestOptions);
		var respCode = resp.getResponseCode();

		return respCode;
	}

	/**
	 * GET THE PAGE PROPERTIES SUMMARY TABEL BASED on CQL (MAX 500 pages).
	 * @param {String} spaceKey Confluence space key.
	 * @param {String} cql Cql page search to extract the page properties from.
	 * @param {boolean} rawData True-> return unprocess data. False -> return the data as an array.
	 */
	getPagePropertiesSummary(spaceKey = 'TEST', cql = null, extractFields = [], rawData = false) {
		let apiDetails = this.jiraCred;
		var baseUrl = apiDetails.baseUrl;
		var header = apiDetails.htmlHeader;

		var MAX_PAGES = 500;
		//https://ltmhedge.atlassian.net/wiki/rest/masterdetail/1.0/detailssummary/lines?spaceKey=EDOC&cql=id=821890893
		cql = encodeURIComponent(`${cql} AND space=${spaceKey}`);
		var url = `${baseUrl}/wiki/rest/masterdetail/1.0/detailssummary/lines?pageSize=${MAX_PAGES}&spaceKey=${spaceKey}&cql=${cql}`;
		try {
			let resp = UrlFetchApp.fetch(url, { headers: header, muteHttpExceptions: true }).getContentText();
			let respJson = JSON.parse(resp);

			if (rawData) return respJson;
			else {
				let opArray = [];
				//Get the header keys by removing all the html tags
				let rowHeaders = respJson.renderedHeadings.map((head) => head.replace(/<[^>]*>?/gm, ''));
				if (extractFields.length == 0) extractFields = [...rowHeaders];

				//For each details line extract the info
				respJson.detailLines.map(({ id, title, relativeLink, details }) => {
					let line = { id, title, relativeLink };
					details.map((detail, i) => {
						if (rowHeaders[i].length > 0 && extractFields.includes(rowHeaders[i])) {
							let valueStr = detail.replace(/<[^>]*>?/gm, ''); //Extract the text between html tags
							line[rowHeaders[i]] = valueStr
								.replace(/&amp;/g, '&')
								.replace(/&#039;/g, "'")
								.trim(); //Repace any html entities and begin and end spaces

							//Check if detials contains data-username (jira id) then extract the user-id
							if (detail.includes('data-username=')) {
								detail = detail.replace(/['"]+/g, '');
								let userNames = detail.match(/(data-username=[a-zA-Z0-9._-]+)/gi);
								let userIds = userNames.map((name) => name.split('=')[1]).join(',');
								// valueStr = valueStr + ` uid:${userIds} `;
								let jsonKey = `${rowHeaders[i]}_uids`;
								line[jsonKey] = userIds;
							}
						}
					});
					opArray.push(line);
				});
				return opArray;
			}
		} catch (error) {
			Logger.log(JSON.stringify(error.message));
			return error.message;
		}
	}

	/**
	 * GET THE CONTANT PROPERTIES OF THE PAGE (MAX 10) or SINGLE PROPERTY BY PASSING THE PROPERTY NAME.
	 * @param {String} pageId Page id to extract the content properties.
	 * @param {String} propertyName Optional property name to extract. If not provided all properties will be extracted.
	 *
	 */
	getContentProperties(pageId = '0000', propertyName = null) {
		let apiDetails = this.jiraCred;
		var baseUrl = apiDetails.baseUrl;
		var header = apiDetails.htmlHeader;

		var url = `${baseUrl}/wiki/rest/api/content/${pageId}/property`;
		url = propertyName ? url + `/${propertyName}` : url;

		let resp = UrlFetchApp.fetch(url, { headers: header, muteHttpExceptions: true }).getContentText();
		let respJson = JSON.parse(resp);

		return respJson;
	}

	/**
	 * UPDATE (or CREATE IF NOT EXISTS) CONTENT PROPERTY WITH THE VALUE PASSED
	 * @param {String} pageId Page id for which the content properties should be updated.
	 * @param {String} propertyName Property key of the content property to udpate.
	 * @param {JSON} value Json object of the property key.
	 * @param {Number} version Next version of the property.
	 */
	updateContentProperty(pageId = '0000', propertyName = 'xxxx', value = {}, version = null) {
		let apiDetails = this.jiraCred;
		var baseUrl = apiDetails.baseUrl;
		var header = apiDetails.htmlHeader;

		try {
			var url = `${baseUrl}/wiki/rest/api/content/${pageId}/property/${propertyName}`;
			if (version == null || isNaN(version)) {
				let resp = this.getContentProperties(pageId, propertyName);
				version = resp.hasOwnProperty('version') ? resp.version.number + 1 : 1;
			}

			var bodyData = {
				value,
				version: {
					number: parseInt(version),
					minorEdit: true
				}
			};

			var requestOptions = {
				method: 'PUT',
				headers: header,
				muteHttpExceptions: true,
				payload: JSON.stringify(bodyData)
			};

			var response = JSON.parse(UrlFetchApp.fetch(url, requestOptions).getContentText());
			return response;
		} catch (error) {
			Logger.log(JSON.stringify(error));
			return error;
		}
	}

	/**
	 * DELETE CONTENT PROPERTIES BY KEY FROM THE PAGE
	 * @param {String} pageId Page id of the page to delete the label from.
	 * @param {String} propKey Key of the property to delete.
	 *
	 * @returns {String} '204' - Label successfully deleted
	 * 				 '403' - User have no edit access to the page.
	 * 				 '404' - Property key not found or user have no read access to the page.
	 * 				 '405' - propKey not sent
	 */
	deleteContentProperty(pageId = '0000', propKey = null) {
		let apiDetails = this.jiraCred;
		var baseUrl = apiDetails.baseUrl;
		var header = apiDetails.htmlHeader;

		if (propKey != null) {
			//https://ltmhedge.atlassian.net/wiki/rest/api/content/835191355/label?name={name}
			var url = `${baseUrl}/wiki/rest/api/content/${pageId}/property/${propKey}`;
			var requestOptions = {
				method: 'DELETE',
				muteHttpExceptions: true,
				headers: header
			};

			var resp = UrlFetchApp.fetch(url, requestOptions);
			var respCode = resp.getResponseCode();
			return respCode;
		} else return '405';
	}

	/**
	 * REMOVE ALL RESTRICTIONS (READ & UPDATE) ON A PAGE.
	 * @param {String} pageId Confluence page id for which restrictions should be removed.
	 */
	deletePageRestrictions(pageId = '0000') {
		let apiDetails = this.jiraCred;
		var baseUrl = apiDetails.baseUrl;
		var header = apiDetails.htmlHeader;

		try {
			var url = `${baseUrl}/wiki/rest/api/content/${pageId}/restriction`;
			var requestOptions = {
				method: 'DELETE',
				muteHttpExceptions: true,
				headers: header
			};

			var resp = UrlFetchApp.fetch(url, requestOptions).getContentText();
			return JSON.parse(resp);
		} catch (error) {
			Logger.log(JSON.stringify(error));
			return error;
		}
	}

	/**
	 * UPDATE PAGE RESTRICTIONS WITH THE USER IDs and GROUP IDs.
	 * IF NO USERS OR GOURPNAMES PASSED, CURRENT USER WILL BE ADDED AS EDIT.
	 * NOTE: CURRENT USER WILL BE AUTOMATICALLY ADDED TO EDIT PERMISSION.
	 * @param {String} pageId Page id of the confluence page to set the permissions.
	 * @param {Array} userIds Array of user ids to allow update.
	 * @param {Array} groupNames Array of group ids to allow update.
	 */
	updatePageRestrictions(pageId = '0000', userIds = [], groupNames = []) {
		let apiDetails = this.jiraCred;
		var baseUrl = apiDetails.baseUrl;
		var header = apiDetails.htmlHeader;

		var bodyData = [];
		var restrictions = {};

		//GET CURRENT USER DETAILS
		var resp = this.getCurrentUser();
		var currUserAccId = resp.hasOwnProperty('accountId') ? resp.accountId : null;

		//Only if current user validated
		if (currUserAccId) {
			var users = [{ type: 'known', accountId: currUserAccId }];
			userIds.map((uid) => {
				users.push({
					type: 'known',
					accountId: uid
				});
			});
			restrictions['user'] = users;

			//Update groups if input given
			var groups = [];
			if (groupNames.length > 0)
				groupNames.map((gName) => {
					groups.push({ type: 'group', name: gName });
				});
			restrictions['group'] = groups;
		}

		bodyData.push({ operation: 'update', restrictions });

		var requestOptions = {
			method: 'PUT',
			headers: header,
			muteHttpExceptions: true,
			payload: JSON.stringify(bodyData)
		};

		var url = `${baseUrl}/wiki/rest/api/content/${pageId}/restriction`;
		var resp = UrlFetchApp.fetch(url, requestOptions).getContentText();
		return JSON.parse(resp);
	}

	/**
	 * COPY PAGE TO CHILD OF DESTINATION PAGE
	 * @param {String} pageId  Page id of the confluence page to copy
	 * @param {String} copyType Valid values are 'child' (default) - copy the page as child to destination page.
	 *                          'replace' - Replace the destination page.
	 * @param {String} destinationPageId destination page to which the page will be child
	 * @param {Array} exclude Properties to exclude while copying. Valid values: ['attachements' 'permissions','labels','customContnets']
	 * @param {String} title Title of the destination page if different from source page.
	 *
	 * @returns {Object} Details of the new page created.
	 */
	copyPageToDestination(pageId = '0000', copyType = 'child', destinationPageId = '0000', exclude = [], title = null) {
		let apiDetails = this.jiraCred;
		var baseUrl = apiDetails.baseUrl;
		var header = apiDetails.htmlHeader;

		//https://ltmhedge.atlassian.net/wiki/rest/api/content/13419195/copy
		var url = `${baseUrl}/wiki/rest/api/content/${pageId}/copy`;
		var body = {};
		body['copyAttachments'] = !exclude.includes('attachements');
		body['copyPermissions'] = !exclude.includes('permissions');
		body['copyProperties'] = !exclude.includes('properties');
		body['copyLabels'] = !exclude.includes('labels');
		body['copyCustomContents'] = !exclude.includes('customContnets');
		body['destination'] = {
			type: copyType === 'replace' ? 'existing_page' : 'parent_page',
			value: destinationPageId
		};
		if (title != null) body['pageTitle'] = title;

		var requestOptions = {
			method: 'POST',
			headers: header,
			muteHttpExceptions: true,
			payload: JSON.stringify(body)
		};

		var resp = UrlFetchApp.fetch(url, requestOptions).getContentText();
		return JSON.parse(resp);
	}

	/**
	 * Create HTML table string that can be used to create/append confluence page function.
	 * @param {Array} dataArray Multi dimensional array with row data
	 * @param {Boolean} setFirstRowAsHeader If set to true, first element of the dataArray is considered as header row
	 *
	 *@returns {String} HTML Table string
	 */
	createConfluenceTableString(dataArray, setFirstRowAsHeader = true) {
		let tblHeader =
			'<table data-layout="default"><colgroup><col style="width: 340.0px;" /><col style="width: 340.0px;" /></colgroup><tbody>';
		let tblFooter = '</tbody></table>';

		let headerRow = dataArray[0];
		let totalCols = headerRow.length;

		let tblHeadRow = '';
		if (setFirstRowAsHeader) {
			tblHeadRow = '<tr>';
			headerRow.forEach((cellVal) => {
				tblHeadRow += `<th><p><strong>${cellVal}</strong></p></th>`;
			});
			tblHeadRow += '</tr>';
			dataArray.shift(); // Remove the header column details
		}

		let tblRows = '';
		dataArray.forEach((row) => {
			if (row.length == totalCols) {
				let singleRow = '<tr>';
				row.forEach((cellValue) => {
					singleRow += `<td><p>${cellValue}</p></td>`;
				});
				singleRow += '</tr>';

				tblRows += singleRow;
			}
		});

		return tblHeader + tblHeadRow + tblRows + tblFooter;
	}

	/**
	 * Returns all (max 250) spaces which have permission to access.
	 * The returned spaces are ordered alphabetically in ascending order by space key.
	 */
	getAllSpaces() {
		var apiDetails = this.jiraCred;
		var baseUrl = apiDetails.baseUrl;
		var header = apiDetails.htmlHeader;
		try {
			let url = `${baseUrl}/wiki/rest/api/space?limit=250`;
			let respJson = JSON.parse(UrlFetchApp.fetch(url, { headers: header, muteHttpExceptions: true }).getContentText());
			return respJson;
		} catch (error) {
			Logger.log(JSON.stringify(error));
			return error;
		}
	}

	/**
	 * Get the last modified page in the space. The method return the page version details.
	 * @param {String} spaceKey Space key of the confluence space
	 * @param {Integer} limit	Number of pages to be returned. By default the method return last updated page and version details.
	 * 							Use limit parameter to get last x number of pages updated in descending order of updated date.
	 */
	getLastUpdatedPage(spaceKey, limit = 1) {
		let cql = `type=page AND space="${spaceKey}" AND lastModified < now() ORDER by lastModified DESC`;
		return this.getContentByCql(cql, ['version'], 1);
	}

	/**
	 * This method return the last created page in the space and its version details.
	 * @param {String} spaceKey Space key of the confluence space
	 * @param {Integer} limit	Number of pages to be returned. By default the method return last created page and version details.
	 * 							Use limit parameter to get last x number of pages updated in descending order of updated date.
	 */
	getLastCreatedPage(spaceKey, limit = 1) {
		let cql = `type=page AND space="${spaceKey}" AND created < now() ORDER by created DESC`;
		return this.getContentByCql(cql, ['version'], 1);
	}

	// /**
	//  * TODO: This is draft function yet to be fully tested
	//  * @param {String} pageId Confluence page id to be copied
	//  * @param {String} destinationPageId Destination page id to be copied to
	//  * @param {Array} exclude
	//  */
	// copyPageHierarchy_(pageId = '0000', destinationPageId = '00000', exclude = []) {
	// 	let apiDetails = this.jiraCred;
	// 	var baseUrl = apiDetails.baseUrl;
	// 	var header = apiDetails.htmlHeader;

	// 	//https://ltmhedge.atlassian.net/wiki/rest/api/content/1335919366/pagehierarchy/copy
	// 	var url = `${baseUrl}/wiki/rest/api/content/${pageId}/pagehierarchy/copy`;
	// 	var bodyData = {
	// 		copyAttachments: true,
	// 		copyPermissions: true,
	// 		copyProperties: true,
	// 		copyLabels: true,
	// 		copyCustomContents: true,
	// 		destinationPageId: destinationPageId,
	// 		titleOptions: {
	// 			prefix: 'v1-',
	// 		},
	// 	};
	// }
}

/* Globally accessible factory method */
function createMkConfluence(filename = 'jiraCred.json') {
	return new MkConfluence(filename);
}
