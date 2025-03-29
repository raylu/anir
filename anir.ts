(function() {
	const url = 'https://graphql.anilist.co';
	function query_a(query: string, variables: object, cb: (response: object) => void) {
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

	function handleResponse(response: Response) {
		return response.json().then(function (json) {
			return response.ok ? json['data'] : Promise.reject(json);
		});
	}

	function handleError(error: any) {
		console.error(error);
	}

	function compareUsers(userName1: string, userName2: string) {
		const userEntries: UserEntries = {};
		const handleMediaList = (response: {'MediaListCollection': MediaListCollection}) => {
			const mediaListCollection = response['MediaListCollection'];

			const entries: Entries = {};
			for (const list of mediaListCollection['lists'])
				for (const entry of list['entries'])
					entries[entry['mediaId']] = entry['score'];

			const userName: string = mediaListCollection['user']['name'];
			userEntries[userName] = entries;

			let th: HTMLTableCellElement;
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

			if (Object.keys(userEntries).length === 2)
				parseResults(userName1, userName2, userEntries);
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

	function parseResults(userName1: string, userName2: string, userEntries: UserEntries) {
		const table : HTMLTableElement = document.querySelector('table.mediaList');

		const user1Entries = userEntries[userName1];
		const user2Entries = userEntries[userName2];
		const mediaIds = [];
		for (const id in user2Entries) {
			if (user1Entries.hasOwnProperty(id)) {
				const user1Score = user1Entries[id];
				const user2Score = user2Entries[id];
				if (user1Score > 0 && user2Score > 0) {
					mediaIds.push(id);
					const row = table.insertRow();
					row.insertCell().id = 'img_' + id;
					row.insertCell().className = 'title_' + id;
					row.insertCell().innerText = String(user1Score);
					row.insertCell().innerText = String(user2Score);
				}
			}
		}

		vectorComparison(mediaIds, user1Entries, user2Entries);
	}

	function getNames(mediaIds: number[], page: number) {
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

	function handleNames(response: {Page: {media: Media[]}}) {
		for (const media of response['Page']['media']) {
			const title = media['title']['userPreferred'];
			const img_td = document.querySelector('td#img_' + media['id']);
			const title_tds = document.querySelectorAll('td.title_' + media['id']);
			const url = 'https://anilist.co/anime/' + media['id'];

			let a = document.createElement('a');
			a.href = url;
			const img = document.createElement('img');
			img.src = media['coverImage']['medium'];
			a.appendChild(img);
			img_td.appendChild(a);

			for (const td of title_tds) {
				a = document.createElement('a');
				a.href = url;
				a.innerText = title;
				td.appendChild(a);
			}
		}
	}

	function vectorComparison(mediaIds: number[], user1Entries: Entries, user2Entries: Entries) {
		// build the top and left columns
		const rows = [];
		const table : HTMLTableElement = document.querySelector('table.vectors');
		const header = table.querySelector('tr');
		for (const id of mediaIds) {
			header.insertCell().className = 'title_' + id;
			const tr = table.insertRow();
			tr.insertCell().className = 'title_' + id;
			rows.push(tr);
		}

		// do the comparisons and build the inner triangle
		let agree = 0;
		let disagree = 0;
		for (let i = 0; i < mediaIds.length; i++) {
			const id1 = mediaIds[i];
			const row = rows[i];
			for (let j = 0; j < i; j++) {
				const id2 = mediaIds[j];
				const user1id1Score = user1Entries[id1];
				const user1id2Score = user1Entries[id2];
				let user1Vector = 0;
				if (user1id1Score < user1id2Score)
					user1Vector = -1;
				else if (user1id1Score > user1id2Score)
					user1Vector = 1;
				let user2Vector = 0;
				const user2id1Score = user2Entries[id1];
				const user2id2Score = user2Entries[id2];
				if (user2id1Score < user2id2Score)
					user2Vector = -1;
				else if (user2id1Score > user2id2Score)
					user2Vector = 1;

				const td = row.insertCell();
				td.innerText = `${user1Vector}/${user2Vector}`;
				if (user1Vector == user2Vector) {
					td.className = 'agree';
					agree += 1;
				}
				else {
					td.className = 'disagree';
					disagree += 1;
				}
			}
		}
		(<HTMLDivElement>document.querySelector('div.compat')).innerHTML +=
			`<span class="agree">${agree} agree</span> - <span class="disagree">${disagree} disagree</span> = ${agree - disagree}`;

		for (let i = 0; i < Math.ceil(mediaIds.length / 50); i++)
			getNames(mediaIds, i + 1);
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

interface MediaListCollection {
	lists: Array<{entries: Array<{mediaId: number, score: number}>}>;
	user: {name: string};
}
interface UserEntries {
	[userName: string]: Entries;
}
interface Entries {
	[mediaId: number]: number;
}
interface Media {
	id: number;
	title: {userPreferred: string};
	coverImage: {medium: string};
}
