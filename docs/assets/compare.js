const API_KEY = 'AKfycbyBlamB6e6do-IOkcby2Ee6VTxLlimJo8WhW-uZokNNUSNf_DpoBiu8shcEtlAA-fg';

function getCompare() {
    const resultDispId = 'compare_result';
    const rawA = document.getElementById('note_id_a').value.trim();
    const rawB = document.getElementById('note_id_b').value.trim();
    const idA = extractNoteID(rawA);
    const idB = extractNoteID(rawB);

    if (!idA || !idB) {
        document.getElementById(resultDispId).innerHTML = '<div class="note_status">IDを2つ入力してください。</div>';
        return;
    }

    document.getElementById(resultDispId).innerHTML =
        '<div class="note_status note_loading">しばらく時間がかかります。。。</div>';
    setFormDisabled(true);

    Promise.all([fetchAPI(idA), fetchAPI(idB)])
        .then(([dataA, dataB]) => {
            setFormDisabled(false);
            drawResult(dataA, dataB, idA, idB, resultDispId);
        })
        .catch(() => {
            setFormDisabled(false);
            document.getElementById(resultDispId).innerHTML = '<div class="note_status">情報を取得できませんでした。</div>';
        });
}

function fetchAPI(id) {
    const url = 'https://script.google.com/macros/s/' + API_KEY +
        '/exec?id=' + encodeURIComponent(id) + '&key=article12';
    return new Promise((resolve, reject) => {
        const req = new XMLHttpRequest();
        req.open('GET', url, true);
        req.onreadystatechange = function () {
            if (req.readyState === 4) {
                if (req.status === 200) {
                    let data;
                    try {
                        data = JSON.parse(req.responseText);
                    } catch (e) {
                        reject(new Error('parse error'));
                        return;
                    }
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

// HTMLに埋め込む値をエスケープ（XSS対策）
function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function(m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
}

function drawResult(dataA, dataB, idA, idB, elementId) {
    if (!Array.isArray(dataA) || !Array.isArray(dataB)) {
        document.getElementById(elementId).innerHTML = '<div class="note_status">情報を取得できませんでした。</div>';
        return;
    }

    const mapA = new Map(dataA.map(u => [u.urlname, u]));

    const common = dataB
        .filter(u => mapA.has(u.urlname))
        .map(u => {
            const uA = mapA.get(u.urlname);
            return { ...u, countA: uA.count, countB: u.count, matchRate: Math.min(uA.count, u.count) / 12 };
        })
        .sort((a, b) => b.matchRate - a.matchRate);

    if (common.length === 0) {
        document.getElementById(elementId).innerHTML = '<div class="note_status">共通のスキユーザーが見つかりませんでした。</div>';
        return;
    }

    let html = '<div class="note_count">' + common.length + '人</div><ul class="note_list">';

    for (const u of common) {
        const rate = Math.round(u.matchRate * 100);
        html += '<li class="note_item">' +
            '<div class="note_row">' +
            '<a class="note_user" href="' + escapeHtml(u.url) + '" target="_blank" rel="noopener">' +
            '<img class="note_avatar" src="' + escapeHtml(u.userProfileImagePath) + '" alt="">' +
            '<span class="note_body">' +
            '<span class="note_data_name">' + escapeHtml(u.nickname) + '</span>' +
            '<span class="note_data_id">@' + escapeHtml(u.urlname) + '</span>' +
            '</span>' +
            '</a>' +
            '<span class="note_like_count">' + rate + '%</span>' +
            '</div>' +
            '<div class="detail">' +
            '<div class="btn-group">' +
            '<button type="button" class="btn-sub" data-urlname="' + escapeHtml(u.urlname) + '">共通好きを探す</button>' +
            '</div>' +
            '</div>' +
            '</li>';
    }
    html += '</ul>';

    document.getElementById(elementId).innerHTML = html;

    document.getElementById(elementId).querySelectorAll('.btn-sub[data-urlname]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            document.getElementById('note_id_b').value = btn.getAttribute('data-urlname');
            getCompare();
        });
    });
}
