---
title: "Authorization details"
description: "Put fine-grained permissions, such as topics or accounts, in access tokens."
weight: 60
---

Scopes say what kind of thing a token may do (`orders:read`). Some APIs need more: which topics a user may subscribe
to, which accounts a payment may come from. RFC 9396 puts this in the token as `authorization_details`, a JSON array
of objects. Each has a `type` that your API defines, plus whatever fields that type has.

In Quisora, **administrators decide the details**, as they decide application roles. They are written into a tenant's
access entries (for the people and groups the entry covers) and onto clients (for the client's own client credentials
tokens). Apps can ask for less than that, never more.

## Setting up

1. **Register the types on the app.** On the client, under **Authorization details types**, list the types it uses,
   exactly as its APIs name them: a URN (`urn:example:admin`) or a URL (`https://example.com/topics`). At most 16, up
   to 256 characters each, no spaces. An app with no types gets no details.
2. **Give the details through access.** In the tenant's **Access** list (for a tenant whose **Who can sign in** is the
   people on the list), edit a user's or group's entry and fill in **Authorization details**: a JSON array of at most
   16 objects and 8 KB. The editor completes common fields and the app's types, and marks mistakes as you type.
3. **For a service that acts as itself**, fill in **Authorization details of its own tokens** on its client (shown
   when **Client credentials** is ticked).

Strings in the details may hold `{{sub}}`, `{{org}}` and `{{tenant}}`, filled in when a token is issued with the
user's id (for a client's own tokens, its client ID) and the ids of the organization and tenant. One entry for a
group can then give each member a topic of their own. Any other `{{...}}` is refused when you save.

A detail with the common field `locations` (a list of API addresses) goes only into tokens whose audience includes one
of them: ask with `resource=<that address>`. A detail without it goes into every token of the app. A user's own entry
and those of their groups add up, each different detail once. A tenant open to everyone in the organization has no
access entries, so its apps get no details from access.

## In the tokens

The access token carries the details as the `authorization_details` claim, filtered to the token's app and audience.
The token response repeats them, and introspection reports them. ID tokens and userinfo never carry them.

```json
{
  "sub": "034q53I8Z6tNZqoaxLu6DR",
  "aud": ["c_chat", "https://hub.example.com/"],
  "authorization_details": [
    {"type": "https://example.com/topics", "actions": ["subscribe"],
     "topics": [{"match": "https://chat.example.com/users/034q53I8Z6tNZqoaxLu6DR"}]}
  ]
}
```

## Asking for less

A request can send `authorization_details` to narrow the token to some types. Quisora reads only the `type` of each
object, and the token then carries the granted details of those types. This works on the authorization request (also
pushed), the device authorization request, and token requests (code exchange, refresh, token exchange, client
credentials). Later requests can narrow further, never widen. When a request asks and nothing is granted, the response
says `"authorization_details": []`.

A request is refused with `invalid_authorization_details` when the parameter is not a JSON array of objects each with
a `type`, or when it names a type the client is not registered for or the earlier authorization did not name.
