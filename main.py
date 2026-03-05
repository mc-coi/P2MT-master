from P2MT_App import create_app
from P2MT_App.config_GAE import Config

app = create_app(config_class=Config)

# Google Debugger
try:
    import googleclouddebugger

    googleclouddebugger.enable(breakpoint_enable_canary=True)
except ImportError:
    pass

if __name__ == "__main__":
    app.run("localhost", 8080, debug=True)
