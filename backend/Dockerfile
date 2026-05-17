FROM python:3.13-slim

WORKDIR /app

# Prevent Python from writing pyc files and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy project
COPY . .

# Expose the Django port
EXPOSE 8000

# Run the development server
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
