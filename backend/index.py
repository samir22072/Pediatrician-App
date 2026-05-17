import os
from core.wsgi import application

# Vercel looks for 'app' or 'application' variable by default
app = application
