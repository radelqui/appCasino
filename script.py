# Paso 1: Crear la estructura base del proyecto
import os
import json

# Crear estructura de directorios
project_structure = {
    'tito-casino-system': {
        'src': {
            'main': {
                'database': {},
                'hardware': {},
                'utils': {},
            },
            'renderer': {
                'components': {
                    'Mesa': {},
                    'Caja': {},
                    'Common': {}
                },
                'services': {},
                'styles': {}
            },
            'shared': {}
        },
        'tests': {
            'unit': {},
            'integration': {},
            'e2e': {}
        },
        'templates': {},
        'config': {},
        'assets': {}
    }
}

def create_directory_structure(structure, base_path=""):
    for name, content in structure.items():
        current_path = os.path.join(base_path, name)
        if isinstance(content, dict):
            os.makedirs(current_path, exist_ok=True)
            if content:  # Si no está vacío, crear subdirectorios
                create_directory_structure(content, current_path)
            else:  # Si está vacío, crear archivo .gitkeep
                with open(os.path.join(current_path, '.gitkeep'), 'w') as f:
                    f.write('')

create_directory_structure(project_structure)
print("✅ Estructura de directorios creada")

# Crear package.json
package_json = {
    "name": "tito-casino-system",
    "version": "1.0.0",
    "description": "Sistema TITO para casino pequeño - Ticket In Ticket Out",
    "main": "src/main/main.js",
    "scripts": {
        "start": "npm run react-start",
        "build": "npm run react-build && npm run electron-pack",
        "react-start": "react-scripts start",
        "react-build": "react-scripts build",
        "electron": "electron .",
        "electron-dev": "concurrently \"npm run react-start\" \"wait-on http://localhost:3000 && electron .\"",
        "electron-pack": "electron-builder",
        "test": "jest",
        "test:watch": "jest --watch",
        "test:coverage": "jest --coverage"
    },
    "dependencies": {
        "react": "^18.2.0",
        "react-dom": "^18.2.0",
        "react-scripts": "5.0.1",
        "@supabase/supabase-js": "^2.38.0",
        "better-sqlite3": "^8.7.0",
        "qrcode": "^1.5.3",
        "pdf-lib": "^1.17.1",
        "node-hid": "^2.1.2",
        "serialport": "^12.0.0"
    },
    "devDependencies": {
        "electron": "^27.0.0",
        "electron-builder": "^24.6.4",
        "concurrently": "^8.2.2",
        "wait-on": "^7.0.1",
        "jest": "^29.7.0",
        "@testing-library/react": "^13.4.0",
        "@testing-library/jest-dom": "^6.1.4",
        "spectron": "^19.0.0"
    },
    "build": {
        "appId": "com.casino.tito",
        "productName": "Sistema TITO Casino",
        "directories": {
            "output": "dist"
        },
        "files": [
            "build/**/*",
            "src/main/**/*",
            "templates/**/*",
            "node_modules/**/*"
        ],
        "win": {
            "target": "nsis",
            "icon": "assets/icon.ico"
        }
    },
    "jest": {
        "testEnvironment": "node",
        "setupFilesAfterEnv": ["@testing-library/jest-dom"],
        "testMatch": ["**/tests/**/*.test.js"],
        "coverageDirectory": "coverage",
        "collectCoverageFrom": [
            "src/**/*.js",
            "!src/main/main.js"
        ]
    }
}

with open('tito-casino-system/package.json', 'w') as f:
    json.dump(package_json, f, indent=2)

print("✅ package.json creado")