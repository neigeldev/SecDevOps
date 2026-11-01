# ZAP Scanning Report

ZAP by [Checkmarx](https://checkmarx.com/).


## Summary of Alerts

| Risk Level | Number of Alerts |
| --- | --- |
| High | 0 |
| Medium | 0 |
| Low | 0 |
| Informational | 3 |




## Alerts

| Name | Risk Level | Number of Instances |
| --- | --- | --- |
| Authentication Request Identified | Informational | 1 |
| Session Management Response Identified | Informational | 9 |
| User Controllable HTML Element Attribute (Potential XSS) | Informational | 1 |




## Alert Detail



### [ Authentication Request Identified ](https://www.zaproxy.org/docs/alerts/10111/)



##### Informational (High)

### Description

The given request has been identified as an authentication request. The 'Other Info' field contains a set of key=value lines which identify any relevant fields. If the request is in a context which has an Authentication Method set to "Auto-Detect" then this rule will change the authentication to match the request identified.

* URL: http://app:3000/login

  * Method: `POST`
  * Parameter: `username`
  * Attack: ``
  * Evidence: `password`
  * Other Info: `userParam=username
userValue=ZAP
passwordParam=password
referer=http://app:3000/login
csrfToken=_csrf`


Instances: 1

### Solution

This is an informational alert rather than a vulnerability and so there is nothing to fix.

### Reference


* [ https://www.zaproxy.org/docs/desktop/addons/authentication-helper/auth-req-id/ ](https://www.zaproxy.org/docs/desktop/addons/authentication-helper/auth-req-id/)



#### Source ID: 3

### [ Session Management Response Identified ](https://www.zaproxy.org/docs/alerts/10112/)



##### Informational (Medium)

### Description

The given response has been identified as containing a session management token. The 'Other Info' field contains a set of header tokens that can be used in the Header Based Session Management Method. If the request is in a context which has a Session Management Method set to "Auto-Detect" then this rule will change the session management to use the tokens identified.

* URL: http://app:3000

  * Method: `GET`
  * Parameter: `__Host-csrf`
  * Attack: ``
  * Evidence: `__Host-csrf`
  * Other Info: `cookie:__Host-csrf`
* URL: http://app:3000/

  * Method: `GET`
  * Parameter: `__Host-csrf`
  * Attack: ``
  * Evidence: `__Host-csrf`
  * Other Info: `cookie:__Host-csrf`
* URL: http://app:3000/explore

  * Method: `GET`
  * Parameter: `__Host-csrf`
  * Attack: ``
  * Evidence: `__Host-csrf`
  * Other Info: `cookie:__Host-csrf`
* URL: http://app:3000/explore%3Fq=ZAP

  * Method: `GET`
  * Parameter: `__Host-csrf`
  * Attack: ``
  * Evidence: `__Host-csrf`
  * Other Info: `cookie:__Host-csrf`
* URL: http://app:3000/login

  * Method: `GET`
  * Parameter: `__Host-csrf`
  * Attack: ``
  * Evidence: `__Host-csrf`
  * Other Info: `cookie:__Host-csrf`
* URL: http://app:3000/register

  * Method: `GET`
  * Parameter: `__Host-csrf`
  * Attack: ``
  * Evidence: `__Host-csrf`
  * Other Info: `cookie:__Host-csrf`
* URL: http://app:3000/robots.txt

  * Method: `GET`
  * Parameter: `__Host-csrf`
  * Attack: ``
  * Evidence: `__Host-csrf`
  * Other Info: `cookie:__Host-csrf`
* URL: http://app:3000/login

  * Method: `POST`
  * Parameter: `__Host-csrf`
  * Attack: ``
  * Evidence: `__Host-csrf`
  * Other Info: `cookie:__Host-csrf`
* URL: http://app:3000/register

  * Method: `POST`
  * Parameter: `__Host-csrf`
  * Attack: ``
  * Evidence: `__Host-csrf`
  * Other Info: `cookie:__Host-csrf`


Instances: 9

### Solution

This is an informational alert rather than a vulnerability and so there is nothing to fix.

### Reference


* [ https://www.zaproxy.org/docs/desktop/addons/authentication-helper/session-mgmt-id/ ](https://www.zaproxy.org/docs/desktop/addons/authentication-helper/session-mgmt-id/)



#### Source ID: 3

### [ User Controllable HTML Element Attribute (Potential XSS) ](https://www.zaproxy.org/docs/alerts/10031/)



##### Informational (Low)

### Description

This check looks at user-supplied input in query string parameters and POST data to identify where certain HTML attribute values might be controlled. This provides hot-spot detection for XSS (cross-site scripting) that will require further review by a security analyst to determine exploitability.

* URL: http://app:3000/explore%3Fq=ZAP

  * Method: `GET`
  * Parameter: `q`
  * Attack: ``
  * Evidence: ``
  * Other Info: `User-controlled HTML attribute values were found. Try injecting special characters to see if XSS might be possible. The page at the following URL:

http://app:3000/explore?q=ZAP

appears to include user input in:
a(n) [input] tag [value] attribute

The user input found was:
q=ZAP

The user-controlled value was:
zap`


Instances: 1

### Solution

Validate all input and sanitize output it before writing to any HTML attributes.

### Reference


* [ https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html ](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)


#### CWE Id: [ 20 ](https://cwe.mitre.org/data/definitions/20.html)


#### WASC Id: 20

#### Source ID: 3


