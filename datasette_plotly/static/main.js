const PlotlyPlugin = (function() {
    let cachedData = null;
    let columns = {};
    let plot = null;

    async function fetchData() {
        const jsonUrl = document.querySelector('link[rel="alternate"][type="application/json+datasette"]').href;
        const dataUrl = jsonUrl + (jsonUrl.includes('?') ? '&_shape=array' : '?_shape=array')
        const resp = await fetch(dataUrl);
        cachedData = await resp.json();
        columns = getColumns(cachedData);
    }

    function getParams() {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        return {
            x: hashParams.get('plt.x') || '',
            y: hashParams.getAll('plt.y'),
            y2: hashParams.getAll('plt.y2'),
            type: hashParams.get('plt.t')
        }
    }

    function createInput(name, type, value, checked) {
        const extra = checked ? ' checked' : '';
        return `<input name="${name}" type="${type}" value="${value}"${extra} />`;
    }

    function getForm() {
        const params = getParams();
        var html = '<form id="plotly-form"><table>';
        html += '<thead><tr><th>Column</th><th>X</th><th>Y</th><th>Y2</th><th>Axis type</td></tr></thead>';
        html += '<tbody>';
        for (const [name, type] of Object.entries(columns)) {
            html += '<tr><td>' + name + '</td>';
            html += '<td>' + createInput('x', 'radio', name, name==params['x']) + '</td>';
            if (type == 'numeric') {
                html += '<td>' + createInput('y', 'checkbox', name, params['y'].includes(name)) + '</td>';
            } else {
                html += '<td></td>';
            }
            if (type == 'numeric') {
                html += '<td>' + createInput('y2', 'checkbox', name, params['y2'].includes(name)) + '</td>';
            } else {
                html += '<td></td>';
            }
            html += '<td>'+(type == 'time' ? 'Date/Time' : type.charAt(0).toUpperCase()+type.substring(1))+'</td>';
            html += '</tr>';
        }
        html += '</tbody></table>';
        html += '<label for="type">Chart type:</label>';
        html += '<select name="type">';
        html += '<option value="line">Line</option>';
        html += '<option value="bars">Bars</option>';
        html += '<option value="stacked-bars">Stacked bars</option>';
        html += '</select>';
        html += '</form>';
        return html;
    }

    function getColumns(data) {
        const columns = {};
        for (const row of data) {
            for (const [key, val] of Object.entries(row)) {
                const valType = typeof val;
                if (columns.hasOwnProperty(key)) {
                    if (columns[key] == 'time') {
                        if ((valType != 'string') || (!dayjs(val).isValid())) {
                            columns[key] = 'label';
                        }
                    } else if ((columns[key] == 'numeric') && (valType != 'number')) {
                        columns[key] = 'label';
                    }
                } else {
                    if (valType == 'number') {
                        columns[key] = 'numeric';
                    } else if (dayjs(val).isValid()) {
                        columns[key] = 'time';
                    } else {
                        columns[key] = 'label';
                    }
                }
            }
        }
        return columns;
    }

    function getContent() {
        return getForm() + '<div id="plotly-chart"></div>';
    }

    function handleInputChange(event) {
        const input = event.target;
        if (input.checked) {
            const inputs = input.closest('tr').querySelectorAll('input');
            for (const other of inputs) {
                if (other !== input) {
                    other.checked = false;
                }
            }
        }
    }

    function addHash(url) {

    }

    function updateUrl(form) {
        const formData = new FormData(form);
        const x = formData.get('x');
        const y = formData.getAll('y');
        const y2 = formData.getAll('y2');
        const t = formData.get('type') || 'line';
        const url = new URL(window.location.href);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        hashParams.delete('plt.x');
        hashParams.delete('plt.y');
        hashParams.delete('plt.y2');
        hashParams.delete('plt.t');
        if (x != null) {
            hashParams.set('plt.x', x);
        }
        y.forEach(col => hashParams.append('plt.y', col));
        y2.forEach(col => hashParams.append('plt.y2', col));
        hashParams.set('plt.t', t);
        const hashStr = hashParams.toString();
        window.location.hash = hashStr;
        var links = Array.from(document.querySelectorAll('.rows-and-columns th a'));
        for (const link of links) {
            if (link.href) {
                link.href += '#'+hashStr;
            }
        }
    }

    function addEventListeners(panel) {
        const form = panel.querySelector('#plotly-form');
        form.querySelectorAll('tr input').forEach(input => {
            input.addEventListener('change', handleInputChange);
        });
        form.addEventListener('change', (event) => {
            updateUrl(event.target.form);
            updateChart();
        });
    }

    function updateChart() {
        const params = getParams();
        const xCol = params['x'];
        const yCols = params['y'];
        const y2Cols = params['y2'];
        const type = params['type'];
        const x = cachedData.map(row => row[xCol]);
        const traces = [];
        for (y of yCols) {
            traces.push({
                'name': y,
                'x': x,
                'y': cachedData.map(row => row[y]),
            });
        }
        for (y of y2Cols) {
            traces.push({
                'name': y,
                'x': x,
                'y': cachedData.map(row => row[y]),
                'yaxis': 'y2'
            });
        }
        if (traces.length > 0) {
            var layout = {
                'autosize': true,
                'showshowlegend': true
            };
            if (yCols.length > 0) {
                layout['yaxis'] = {
                    'title': {
                        'text': yCols.join(' / ')
                    }
                };
            }
            if (y2Cols.length > 0) {
                layout['yaxis2'] = {
                    'title': {
                        'text': y2Cols.join(' / ')
                    },
                    'overlaying': 'y',
                    'side': 'right'
                };
            }
            if (type.includes('bars')) {
                for (trace of traces) {
                    trace['type'] = 'bar';
                }
                if (type == 'stacked-bars') {
                    layout['barmode'] = 'stack';
                }
            }
            document.getElementById('plotly-chart').innerHTML = '';
            plot = Plotly.newPlot('plotly-chart', traces, layout);
        } else {
            document.getElementById('plotly-chart').innerHTML = 'The chart will appear here after selecting X and at least one of Y or Y2';
            plot = null;
        }
    }

    async function initialize() {
        const panel = document.getElementById('plotly-panel');
        if (panel != null) {
            await fetchData();
            panel.innerHTML = getContent();
            addEventListeners(panel);
            updateChart();
        }
    }

    // Public API
    return {
        initialize: initialize
    }
})();

document.addEventListener('datasette_init', PlotlyPlugin.initialize);
