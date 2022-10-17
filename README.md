# uncli
utility network javascript command line works on Windows and Linux

## Download Node JS 13.5 or later

https://nodejs.org/en/

## Open command prompt and run this command

```bash
npm install -g un-cli
```

## Once installed here is how you connect 

```bash
> uncli --portal https://utilitynetwork.esri.com/portal --service NapervilleElectric_SQLServer --user tester --password tester.108 
```

```bash

uncli> help
┌───────────────────────────────────────┬──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                (index)                │                                                          Values                                                          │
├───────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                 help                  │                                                   'Displays this help'                                                   │
│                version                │                                             'Displays the version of uncli'                                              │
│                  ls                   │                                                   'List all services'                                                    │
│                  def                  │                                          'Show the feature service definition'                                           │
│             def --layers              │                                            'List all layers in this service'                                             │
│              subnetworks              │                                                 'Lists all subnetworks'                                                  │
│          subnetworks --dirty          │                                              'Lists only dirty subnetworks'                                              │
│         subnetworks --deleted         │                                          'Lists dirty and deleted subnetworks'                                           │
│               evaluate                │                                                  'Evaluate in parallel'                                                  │
│    trace --subnetwork <subnetwork>    │                     'Traces input subnetwork and returns the time and number of elements returned .'                     │
│               topology                │                                              'Displays the topology status'                                              │
│          topology --disable           │                                                    'Disable topology'                                                    │
│           topology --enable           │                                                    'Enable topology'                                                     │
│          topology --validate          │                                            'Validate topology (full extent)'                                             │
│       update subnetworks --all        │                                       'Update all dirty subnetworks synchronously'                                       │
│     update subnetworks --deleted      │                                   'Update all deleted dirty subnetworks synchronously'                                   │
│   update subnetworks --all --async    │                                      'Update all dirty subnetworks asynchronously'                                       │
│       export subnetworks --all        │                                            'Export all subnetworks with ACK '                                            │
│       export subnetworks --new        │                              "Export all subnetworks with ACK that haven't been exported "                               │
│     export subnetworks --deleted      │                                   'Export all subnetworks with ACK that are deleted '                                    │
│                 count                 │                                    'Lists the number of rows in all feature layers.'                                     │
│            count --system             │                                       'Lists the number of rows in system layers.'                                       │
│           connect --service           │                                            'Connects to the another service'                                             │
│       tracelogs --age <minutes>       │                    'Lists utility network trace summary logs for the last x minutes (requires admin)'                    │
│     validatelogs --age <minutes>      │                  'Lists utility network validate summary logs for the last x minutes (requires admin)'                   │
│ updatesubnetworkslog --age <minutes>  │             'Lists utility network update subnetworks summary logs for the last x minutes (requires admin)'              │
│        arlogs --age <minutes>         │                     'Lists attribute rules execution logs for the last x minutes  (requires admin)'                      │
│ arlogs --byrule [--minguid --maxguid] │ 'Lists attribute rules execution summary by rule (requires admin), --maxguid and --minguid show the GUID of the feature' │
│        topsql --age <minutes>         │                           'Lists all queries executed in the last x minutes  (requires admin)'                           │
│                whoami                 │                                              'Lists the current login info'                                              │
│                 clear                 │                                                   'Clears this screen'                                                   │
│                 quit                  │                                                   'Exit this program'                                                    │
└───────────────────────────────────────┴──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```


 
## Execute bulk of commands
Create a commands.txt file and type in the commands in that file
command.txt
```text
update subnetworks --all
export subnetworks --new
```


> uncli --portal https://utilitynetwork.esri.com/portal --service NapervilleElectric_SQLServer --user tester --password tester.108 --file commands.txt --verify true

## Server Log web parser
This tool also provides a way to parse server logs and view them for each utility network and geodatabase function

To install on IIS follow these steps: This server assume your machine name where the Webadaptor lives is `utilitynetwork.esri.com` 

- Login to machine where you have the webadaptor
- Create a folder called `log` in `c:\inetpub\wwwroot`
- Copy the entire content of the repro https://github.com/hussein-nasser/uncli to c:\inetpub\wwwroot\log
- Open IIS (Internet Information Services)
- Open MIME Types
- Under action click Add 
- under file extension type `.mjs` and under MIME Type write `application/javascript`
- Restart IIS
- (OPTIONAL only change when your webadaptor is not /portal) In c:\inetpub\wwwroot\log edit the `index.html` and find this line of code
- Update the JSON object with the correct URL, for example if your webadaptor is https://utilitynetwork.esri.com/portal set the "portal" to be that. You don't have to update the referer it will be automatically calculated it.  

```js
let parameters = {
        "user": "unadmin",
        "password": "",
        "portal": "",
        "service": "",
        "referer": ""
    }
    ```
- Save the HTML and then visit `https://utilitynetwork.esri.com/log` put in your username and password and login to use the parser
