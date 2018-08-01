(function() {
	const url = 'https://graphql.anilist.co';
	function query_a(query: string, variables: object, cb) {
		const options = {
			'method': 'POST',
			'headers': {
				'Content-Type': 'application/json',
				'Accept': 'application/json',
			},
			'body': JSON.stringify({
				'query': query,
				'variables': variables,
			})
		};
		fetch(url, options).then(handleResponse).then(cb).catch(handleError);
	}

	function handleResponse(response) {
		return response.json().then(function (json) {
			return response.ok ? json['data'] : Promise.reject(json);
		});
	}

	function handleError(error) {
		console.error(error);
	}

	function compareUsers(userName1: string, userName2: string) {
		const userEntries = {};
		const handleMediaList = (response) => {
			const mediaListCollection = response['MediaListCollection'];

			const entries = {};
			for (const list of mediaListCollection['lists'])
				for (const entry of list['entries'])
					entries[entry['mediaId']] = entry['score'];

			const userName = mediaListCollection['user']['name'];
			userEntries[userName] = entries;

			let th;
			if (userName.toLowerCase() == userName1) {
				userName1 = userName;
				th = document.querySelector('th#userName1');
			} else {
				userName2 = userName;
				th = document.querySelector('th#userName2');
			}
			const a = document.createElement('a');
			a.href = `https://anilist.co/user/${userName}/animelist`;
			a.innerText = userName;
			th.appendChild(a);

			if (Object.keys(userEntries).length === 2) {
				parseResults(userName1, userName2, userEntries);
			}
		};

		const query = `query ($name: String) {
			MediaListCollection(type: ANIME, userName: $name) {
				lists { entries { mediaId score } }
				user { name }
			}
		}`;
		query_a(query, {'name': userName1}, handleMediaList);
		query_a(query, {'name': userName2}, handleMediaList);
	}

	function parseResults(userName1: string, userName2: string, userEntries: object) {
		const table = document.querySelector('table');

		const user1Entries = userEntries[userName1];
		const user2Entries = userEntries[userName2];
		const mediaIds = [];
		for (const id in user2Entries) {
			if (user1Entries.hasOwnProperty(id)) {
				mediaIds.push(id);
				const user1Score = user1Entries[id];
				const user2Score = user2Entries[id];
				const row = table.insertRow();
				row.insertCell().id = 'img_' + id;
				row.insertCell().id = 'title_' + id;
				row.insertCell().innerText = user1Score;
				row.insertCell().innerText = user2Score;
			}
		}

		for (let i = 0; i < Math.ceil(mediaIds.length / 50); i++)
			getNames(mediaIds, i + 1);
	}

	function getNames(mediaIds: Array<number>, page: number) {
		const query = `query ($page: Int, $mediaIds: [Int]) {
			Page(page: $page, perPage: 50) {
				media(id_in: $mediaIds) {
					id
					title { userPreferred }
					coverImage { medium }
				}
			}
		}`;
		query_a(query, {'page': page, 'mediaIds': mediaIds}, handleNames);
	}

	function handleNames(response: {Page: {media: Array<object>}}) {
		for (const media of response['Page']['media']) {
			const title = media['title']['userPreferred'];
			const img_td = document.querySelector('td#img_' + media['id']);
			const title_td = document.querySelector('td#title_' + media['id']);
			const url = 'https://anilist.co/anime/' + media['id'];

			let a = document.createElement('a');
			a.href = url;
			const img = document.createElement('img');
			img.src = media['coverImage']['medium'];
			a.appendChild(img);
			img_td.appendChild(a);

			a = document.createElement('a');
			a.href = url;
			a.innerText = title;
			title_td.appendChild(a);
		}
	}

	const userNames = [null, null];
	const query = document.location.search.substr(1);
	for (const pair of query.split('&')) {
		const [key, value] = pair.split('=');
		const username = decodeURIComponent(value).toLowerCase()
		if (key === 'u1')
			userNames[0] = username;
		else if (key === 'u2')
			userNames[1] = username;
	}
	if (userNames[0] !== null && userNames[1] !== null) {
		(<HTMLInputElement>document.querySelector('form input[name="u1"]')).value = userNames[0];
		(<HTMLInputElement>document.querySelector('form input[name="u2"]')).value = userNames[1];
		compareUsers(userNames[0], userNames[1]);
	}
})();
