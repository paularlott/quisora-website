---
title: "Source addresses"
weight: 90
---

`source_addresses` is a list of addresses or CIDR ranges (`203.0.113.7`, `203.0.113.0/24`, `2001:db8::/32`): the
certificate then has the OpenSSH `source-address` critical option, and sshd refuses it from anywhere else. Use it
for a VPN or office range. It is fixed in a certificate when it is made, so lifting the restriction changes nothing for
certificates already issued; setting or changing the addresses revokes the live certificates made with other addresses
(`settings_changed`), and people get new ones. An address without a prefix length means that one address.
