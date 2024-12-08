from datasette import hookimpl

@hookimpl
async def extra_js_urls(template, database, table, columns, view_name, request, datasette):
    return [
        'https://cdn.jsdelivr.net/npm/dayjs@1/dayjs.min.js',
        #'https://cdn.plot.ly/plotly-3.0.0-rc.1.min.js',
        'https://cdn.jsdelivr.net/npm/apexcharts',
        '/-/static-plugins/datasette-plotly/main.js'
    ]

@hookimpl
async def extra_css_urls(template, database, table, columns, view_name, request, datasette):
    return [
        '/-/static-plugins/datasette-plotly/main.css'
    ]

@hookimpl
def top_table(datasette, request, database, table):
    return '<div id="plotly-panel"></div>';

@hookimpl
def top_query(datasette, request, database, sql):
    return '<div id="plotly-panel"></div>';
