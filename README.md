# FretNot 🏅 Winner of the IEEE award at Stormhacks 2025!
Fretnot is a tool to help beginners of guitar learn the fingerings of the chords by projecting lasers on the proper frets and strings. It can also read the lyrics and chords of a song and subquentially play through the lyrics displaying the chords so you can learn alongside your favorite song. The project was made under 24 hours for [Stormhacks 2025](https://stormhacks2025.devpost.com/), which had over 750 participants.

The full details can be found on the project [Devpost.](https://devpost.com/software/fretnot)

## Video Demo
https://github.com/user-attachments/assets/6231e117-ce61-4dc8-b68a-ef002af53ecd

## The Stack
This project uses an ESP32 with a bluetooth connection to a web interface. The ESP32 listens in on the `chord` characteristic to display the proper chords. The fretnot subfolder contains the React+Typescript user interface, which supports individual chord playing and the parsing of song lyrics for a user friendly "performance" mode.
Upload the arduino code to an ESP-32, then run the vite+react project in the fretnot subfolder as an interface.

### ESP32
The code has a convenient 2D matrix that maps to the various indivudal frets and strings so that the laser diodes can be easily configured to any GPIO pin. Simply assign the pins in the matrix and add more chords as needed to the map. Whenever the ESP32 receives that chord through the `chord` characteristic, it will display that chord, with the default being turning all diodes off. Additionally, since this is using BLE, it is very easy to implement with other interfaces.

### Web Interface
This is a standard React+Typescript projects, so you can do the default installation of `npm install` to install the dependencies and `npm run dev` to run the development build. It uses the browsers built in bluetooth support to connect to the ESP32 and send messages to the characteristic. The parsing uses the Tesseract OCR to parse the lyrics and map them with the chords, and is admittly currently fitted to Creep by Radiohead.
