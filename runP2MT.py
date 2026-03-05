from P2MT_App import create_app
from P2MT_App.config import Config

app = create_app(config_class=Config)

if __name__ == "__main__":
    app.run("localhost", 8080, debug=True)
