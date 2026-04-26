const API_KEY = 'AKfycbyBlamB6e6do-IOkcby2Ee6VTxLlimJo8WhW-uZokNNUSNf_DpoBiu8shcEtlAA-fg';

function getCompare() {
    const resultDispId = 'compare_result';
    const rawA = document.getElementById('note_id_a').value.trim();
    const rawB = document.getElementById('note_id_b').value.trim();
    const idA = extractNoteID(rawA);
    const idB = extractNoteID(rawB);

    if (!idA || !idB) {
        document.getElementById(resultDispId).innerHTML = 'IDを2つ入力してください。';
        return;
    }

    document.getElementById(resultDispId).innerHTML =
        '<img src="img/waiting.gif" width="50" height="50"><br>しばらく時間がかかります。。。<br><br><br>';
    setFormDisabled(true);

    Promise.all([fetchAPI(idA), fetchAPI(idB)])
        .then(([dataA, dataB]) => {
            setFormDisabled(false);
            drawResult(dataA, dataB, idA, idB, resultDispId);
        })
        .catch(() => {
            setFormDisabled(false);
            document.getElementById(resultDispId).innerHTML = '情報を取得できませんでした。<br><br><br>';
        });
}

function fetchAPI(id) {
    const url = 'https://script.google.com/macros/s/' + API_KEY + '/exec?id=' + id + '&key=article12';
    return new Promise((resolve, reject) => {
        const req = new XMLHttpRequest();
        req.open('GET', url, true);
        req.onreadystatechange = function () {
            if (req.readyState === 4) {
                if (req.status === 200) {
                    const data = JSON.parse(req.responseText);
                    if (data === 'error') reject(new Error('API error'));
                    else resolve(data);
                } else {
                    reject(new Error('HTTP ' + req.status));
                }
            }
        };
        req.send(null);
    });
}

function extractNoteID(input) {
    if (input.includes('note.com/')) {
        return input.split('/')[3]?.trim() || '';
    }
    return input;
}

function setFormDisabled(lock) {
    document.getElementById('compare_exe').disabled = lock;
    document.getElementById('note_id_a').disabled = lock;
    document.getElementById('note_id_b').disabled = lock;
}

function drawResult(dataA, dataB, idA, idB, elementId) {
    if (!Array.isArray(dataA) || !Array.isArray(dataB)) {
        document.getElementById(elementId).innerHTML = '情報を取得できませんでした。<br><br><br>';
        return;
    }

    const mapA = new Map(dataA.map(u => [u.urlname, u]));

    const common = dataB
        .filter(u => mapA.has(u.urlname))
        .map(u => {
            const uA = mapA.get(u.urlname);
            return { ...u, countA: uA.count, countB: u.count, matchRate: (uA.count + u.count) / 24 };
        })
        .sort((a, b) => b.matchRate - a.matchRate);

    if (common.length === 0) {
        document.getElementById(elementId).innerHTML = '共通のスキユーザーが見つかりませんでした。<br><br><br>';
        return;
    }

    let html = '<table class="note_list">';
    html += '<tr><th>なまえ / ID</th><th style="white-space:nowrap;font-size:1.2rem;">一致率</th></tr>';

    for (const u of common) {
        const rate = Math.round(u.matchRate * 100);
        html += '<tr>' +
            '<td>' +
            '<div class="note_data_container">' +
            '<div class="note_icon"><a href="' + u.url + '" target="_blank">' +
            '<img class="note_icon_img" src="' + u.userProfileImagePath + '"></a></div>' +
            '<div class="note_username">' +
            '<div class="note_username_nickname"><a href="' + u.url + '" target="_blank">' + u.nickname + '</a></div>' +
            '<div class="note_data_name">' + u.urlname + '</div>' +
            '</div></div>' +
            '<div class="detail"><div style="display:flex;justify-content:space-between;">' +
            '<a class="btn-sub" href="index.html?id=' + u.urlname + '&key=article12">このユーザで集計</a>' +
            '</div></div>' +
            '</div>' +
            '</td>' +
            '<td class="note_data_count">' + rate + '%</td>' +
            '</tr>';
    }
    html += '</table>';

    document.getElementById(elementId).innerHTML = html;
}
