.PHONY: $(shell sed -n -e '/^$$/ { n ; /^[^ .\#][^ ]*:/ { s/:.*$$// ; p ; } ; }' $(MAKEFILE_LIST))

this_dir := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))

help:
	 @echo "$$(grep -hE '^\S+:.*##' $(MAKEFILE_LIST) | sed -e 's/:.*##\s*/:/' -e 's/^\(.\+\):\(.*\)/\\x1b[36m\1\\x1b[m:\2/' | column -c2 -t -s :)"

PID_FILE := .server.pid

run: install start open ## install, start and open <-

install:
	npm install

start: stop
	node server.js & echo $$! > $(PID_FILE)
	@sleep 2
	@if kill -0 $$(cat $(PID_FILE)) 2>/dev/null; then \
		echo "Server started (PID: $$(cat $(PID_FILE)))"; \
	else \
		echo "Server failed to start"; \
		rm -f $(PID_FILE); \
		exit 1; \
	fi

stop: ## stop
	@if [ -f $(PID_FILE) ]; then \
		kill $$(cat $(PID_FILE)) 2>/dev/null || true; \
		rm -f $(PID_FILE); \
		echo "Server stopped"; \
	fi

restart: stop start

open:
	open http://localhost:3000

status: ## status
	@if [ -f $(PID_FILE) ] && kill -0 $$(cat $(PID_FILE)) 2>/dev/null; then \
		echo "Server running (PID: $$(cat $(PID_FILE)))"; \
	else \
		echo "Server not running"; \
		rm -f $(PID_FILE) 2>/dev/null || true; \
	fi
