'use strict';

const API_KEY = 'AKfycbyBlamB6e6do-IOkcby2Ee6VTxLlimJo8WhW-uZokNNUSNf_DpoBiu8shcEtlAA-fg';

const ANCHOR_RADIUS = 56;
const TOP_N = 25;
const rScale = d3.scaleSqrt().domain([0, 1]).range([16, 40]);

let nodes = [];
let links = [];
let nodesById = new Map();
let dataAnchor = null;

let svg, container, linkLayer, nodeLayer, simulation;
let width = 0, height = 0;

function getBabbles() {
    const raw = document.getElementById('note_id').value.trim();
    const id = extractNoteID(raw);

    if (!id) {
        setStatus('<div class="note_status">IDを入力してください。</div>');
        return;
    }

    resetGraph();
    setStatus('<div class="note_status note_loading">しばらく時間がかかります。。。</div>');
    setFormDisabled(true);

    fetchAPI(id)
        .then(data => {
            setFormDisabled(false);
            if (!Array.isArray(data)) {
                setStatus('<div class="note_status">情報を取得できませんでした。</div>');
                return;
            }
            dataAnchor = data;
            setStatus('');
            initGraph();

            const anchorNode = addNode({ urlname: id }, { isAnchor: true, expanded: true, matchRate: 1 });
            anchorNode.fx = width / 2;
            anchorNode.fy = height / 2;

            dataAnchor.slice(0, TOP_N).forEach(u => {
                const child = addNode(u, { matchRate: Math.min(u.count / 12, 1) });
                addLink(anchorNode.id, child.id);
            });

            updateGraph();
        })
        .catch(() => {
            setFormDisabled(false);
            setStatus('<div class="note_status">情報を取得できませんでした。</div>');
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
    document.getElementById('babble_exe').disabled = lock;
    document.getElementById('note_id').disabled = lock;
}

function setStatus(html) {
    document.getElementById('babble_status').innerHTML = html;
}

function toggleBabblePanel() {
    const panel = document.getElementById('babble_panel');
    const toggle = document.getElementById('babble_panel_toggle');
    const collapsed = panel.classList.toggle('is-collapsed');
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', collapsed ? '展開する' : '折りたたむ');
}

// dataA(起点ユーザーへのスキ提供者一覧)とdataTarget(比較対象へのスキ提供者一覧)の積集合を、一致率付きで返す
function computeCommon(dataA, dataTarget) {
    const mapA = new Map(dataA.map(u => [u.urlname, u]));
    return dataTarget
        .filter(u => mapA.has(u.urlname))
        .map(u => {
            const uA = mapA.get(u.urlname);
            return { ...u, countA: uA.count, countB: u.count, matchRate: Math.min(uA.count, u.count) / 12 };
        })
        .sort((a, b) => b.matchRate - a.matchRate);
}

function resetGraph() {
    nodes = [];
    links = [];
    nodesById = new Map();
    dataAnchor = null;
    if (simulation) {
        simulation.stop();
        simulation = null;
    }
    document.getElementById('babble_graph').innerHTML = '';
}

function initGraph() {
    const el = document.getElementById('babble_graph');
    width = el.clientWidth || 600;
    height = el.clientHeight || 560;

    svg = d3.select(el).append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', [0, 0, width, height]);

    container = svg.append('g');

    svg.call(d3.zoom()
        .scaleExtent([0.3, 4])
        .filter(event => event.type !== 'wheel')
        .on('zoom', (event) => container.attr('transform', event.transform)));

    linkLayer = container.append('g').attr('class', 'babble-links');
    nodeLayer = container.append('g').attr('class', 'babble-nodes');

    simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => d.id).distance(90).strength(0.5))
        .force('charge', d3.forceManyBody().strength(-260))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collide', d3.forceCollide(d => d.r + 6))
        .on('tick', ticked);
}

function nodeRadius(d) {
    if (d.isAnchor) return ANCHOR_RADIUS;
    return rScale(d.matchRate || 0);
}

function addNode(user, opts) {
    const id = user.urlname;
    if (nodesById.has(id)) {
        const existing = nodesById.get(id);
        if (opts.matchRate !== undefined && opts.matchRate > (existing.matchRate || 0)) {
            existing.matchRate = opts.matchRate;
        }
        return existing;
    }
    const node = {
        id,
        nickname: user.nickname || id,
        url: user.url || ('https://note.com/' + id),
        avatar: user.userProfileImagePath || null,
        matchRate: 0,
        isAnchor: false,
        expanded: false,
        loading: false,
        error: false,
        x: width / 2 + (Math.random() - 0.5) * 60,
        y: height / 2 + (Math.random() - 0.5) * 60,
        ...opts
    };
    node.r = nodeRadius(node);
    nodes.push(node);
    nodesById.set(id, node);
    return node;
}

function addLink(sourceId, targetId) {
    if (sourceId === targetId) return;
    const exists = links.some(l => {
        const s = typeof l.source === 'object' ? l.source.id : l.source;
        const t = typeof l.target === 'object' ? l.target.id : l.target;
        return (s === sourceId && t === targetId) || (s === targetId && t === sourceId);
    });
    if (!exists) links.push({ source: sourceId, target: targetId });
}

function expandNode(node) {
    if (node.isAnchor || node.expanded || node.loading) return;
    node.loading = true;
    updateGraph();

    fetchAPI(node.id)
        .then(data => {
            node.loading = false;
            node.expanded = true;
            if (!Array.isArray(data)) {
                node.error = true;
                updateGraph();
                return;
            }
            const common = computeCommon(dataAnchor, data);
            common.forEach(u => {
                const child = addNode(u, { matchRate: u.matchRate });
                addLink(node.id, child.id);
            });
            updateGraph();
        })
        .catch(() => {
            node.loading = false;
            node.error = true;
            updateGraph();
        });
}

function updateGraph() {
    nodes.forEach(d => { d.r = nodeRadius(d); });

    simulation.nodes(nodes);
    simulation.force('link').links(links);
    simulation.alpha(0.6).restart();

    const linkSel = linkLayer.selectAll('line.babble-link')
        .data(links, d => (d.source.id || d.source) + '-' + (d.target.id || d.target));
    linkSel.exit().remove();
    linkSel.enter().append('line').attr('class', 'babble-link');

    const nodeSel = nodeLayer.selectAll('g.babble-node').data(nodes, d => d.id);
    nodeSel.exit().remove();

    const nodeEnter = nodeSel.enter().append('g')
        .attr('class', 'babble-node')
        .call(drag(simulation))
        .on('click', (event, d) => expandNode(d));

    nodeEnter.append('title');

    nodeEnter.each(function (d) {
        const gEl = d3.select(this);
        if (d.isAnchor) {
            gEl.append('circle').attr('class', 'babble-avatar-fallback');
            gEl.append('image')
                .attr('class', 'babble-anchor-icon')
                .attr('preserveAspectRatio', 'xMidYMid meet')
                .attr('href', 'img/person_icon.png');
        } else if (d.avatar) {
            const clipId = 'clip-' + d.id.replace(/[^a-zA-Z0-9_-]/g, '');
            gEl.append('clipPath').attr('id', clipId).append('circle');
            gEl.append('image')
                .attr('class', 'babble-avatar')
                .attr('clip-path', 'url(#' + clipId + ')')
                .attr('preserveAspectRatio', 'xMidYMid slice')
                .attr('href', d.avatar);
        } else {
            gEl.append('circle').attr('class', 'babble-avatar-fallback');
            gEl.append('text').attr('class', 'babble-initial').text(d.id.charAt(0).toUpperCase());
        }
        gEl.append('circle').attr('class', 'babble-ring');
    });

    const nodeMerge = nodeEnter.merge(nodeSel);

    nodeMerge
        .classed('is-anchor', d => d.isAnchor)
        .classed('is-loading', d => d.loading)
        .classed('is-expanded', d => d.expanded && !d.isAnchor)
        .classed('is-error', d => d.error)
        .classed('is-expandable', d => !d.isAnchor && !d.expanded && !d.loading);

    nodeMerge.select('title').text(d => {
        const rate = Math.round((d.matchRate || 0) * 100);
        let label = d.nickname + ' (@' + d.id + ')';
        if (!d.isAnchor) label += ' - 関連度 ' + rate + '%';
        if (!d.isAnchor && !d.expanded) label += ' / クリックで展開';
        return label;
    });

    nodeMerge.each(function (d) {
        const gEl = d3.select(this);
        const r = d.r;
        gEl.select('clipPath circle').attr('r', r);
        gEl.select('image.babble-avatar')
            .attr('x', -r).attr('y', -r).attr('width', r * 2).attr('height', r * 2);
        gEl.select('circle.babble-avatar-fallback').attr('r', r);
        gEl.select('text.babble-initial').attr('font-size', r * 0.9);
        const iconSize = r * 1.3;
        gEl.select('image.babble-anchor-icon')
            .attr('x', -iconSize / 2).attr('y', -iconSize / 2)
            .attr('width', iconSize).attr('height', iconSize);
        gEl.select('circle.babble-ring').attr('r', r);
    });

    nodeLayer.__sel = nodeMerge;
    linkLayer.__sel = linkLayer.selectAll('line.babble-link');
}

function ticked() {
    if (linkLayer.__sel) {
        linkLayer.__sel
            .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
    }
    if (nodeLayer.__sel) {
        nodeLayer.__sel.attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');
    }
}

function drag(sim) {
    function dragstarted(event, d) {
        if (!event.active) sim.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }
    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }
    function dragended(event, d) {
        if (!event.active) sim.alphaTarget(0);
        // ドラッグして意図的に動かした位置はそのまま固定する（fx/fyを解放しない）
    }
    return d3.drag().on('start', dragstarted).on('drag', dragged).on('end', dragended);
}
