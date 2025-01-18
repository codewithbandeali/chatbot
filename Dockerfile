FROM python:3.9-slim

# Set the working directory
WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy the app
COPY . .

# Expose the app's port and run the Flask app
EXPOSE 5000
CMD ["python", "app.py"]
