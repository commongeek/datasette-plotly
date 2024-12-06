# datasette-plotly

[![PyPI](https://img.shields.io/pypi/v/datasette-plotly.svg)](https://pypi.org/project/datasette-plotly/)
[![Changelog](https://img.shields.io/github/v/release/commongeek/datasette-plotly?include_prereleases&label=changelog)](https://github.com/commongeek/datasette-plotly/releases)
[![Tests](https://github.com/commongeek/datasette-plotly/actions/workflows/test.yml/badge.svg)](https://github.com/commongeek/datasette-plotly/actions/workflows/test.yml)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](https://github.com/commongeek/datasette-plotly/blob/main/LICENSE)

Datasette plugin for making charts from tables and SQL queries using Plotly.js

## Installation

Install this plugin in the same environment as Datasette.
```bash
datasette install datasette-plotly
```
## Usage

Usage instructions go here.

## Development

To set up this plugin locally, first checkout the code. Then create a new virtual environment:
```bash
cd datasette-plotly
python -m venv venv
source venv/bin/activate
```
Now install the dependencies and test dependencies:
```bash
pip install -e '.[test]'
```
To run the tests:
```bash
python -m pytest
```
