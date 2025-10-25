# hifi-link 📀⚡️📻

Since the 1980s, many amplifiers, receivers, tape decks, cd players and even some turntables come with remote controls. This is great for controlling the equipment from a distance. However, there are some unsatisfying limitations: range, obstacles blocking the signal and more.

Nowadays, the remotes we all have in our pockets are our smartphones. What if we could bring all remotes into a singular system remote, fully configurable and with advanced functionalities right into our pocket?

That is what **hifi-link** is all about.

<ul>
→ Build your own remote interface<br/>
→ Extend your hifi setup with fully customizable timer programs<br/>
→ Control your equipment from any room
</ul>

## A variety of protocols

Naturally, every manufacturer has a different remote. On some hifi systems, only the receiver has an infrared sensor and signals are only passed down the line using cables. On newer systems, APIs exist, already connecting the device over the network.

The aim of hifi-link is to enable the implementation of many different protocols and to provide an environment along with configuration and user interface.

## Hardware

Right now, the project is focused on the Raspberry Pi Pico W as it is a very cheap and wifi enabled microcontroller. 

The most basic functionality of hifi-link is imitating an infrared remote. To be able to send infrared signals with hifi-link, you only need an IR-LED, two resistors and a transistor like the 2N2222 or the 2N3904.
To capture the signals of you exisiting remote, you will need an additional TSOP38238 or something similar. (see `TODO: IR-Transceiver-Wiring.md`)

For cable driven protocols like Kenwoods XS8 or SL16, you can just tear an old 3.5mm audio cable apart and solder jumper wires at the end.

## Using hifi-link

When opening the hifi-link app or webpage for the first time, you'll be able to select connected devices and their protocols.

To be able to infrared control your equipment, it is probably easiest to teach hifi-link your existing remote. But it will be possible to control devices you do not have the physical remote for.

The nice part about hifi-link is that you will be able to configure the interface however you like, be it simple or advanced.

## Setup

`TODO`

## Contributing

If your device is not yet supported by the capabilities of hifi-link, I encourage you to implement the control protocol in hifi-link and contribute!
This way, hifi-link will be able to support a wide variety of devices.
