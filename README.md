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
┌─────────────────────────┬───────────────────────────────────────────────────────────────┐
│         (index)         │                            Values                             │
├─────────────────────────┼───────────────────────────────────────────────────────────────┤
│          help           │                     'Displays this help'                      │
│         version         │                'Displays the version of uncli'                │
│           ls            │                      'List all services'                      │
│           def           │             'Show the feature service definition'             │
│       def -layers       │               'List all layers in this service'               │
│       subnetworks       │                    'Lists all subnetworks'                    │
│     subnetworks -d      │                'Lists only dirty subnetworks'                 │
│ update subnetworks -all │                'Update all dirty subnetworks '                │
│ export subnetworks -all │              'Export all subnetworks with ACK '               │
│ export subnetworks -new │ "Export all subnetworks with ACK that haven't been exported " │
│          count          │       'Lists the number of rows in all feature layers.'       │
│      count -system      │         'Lists the number of rows in system layers.'          │
│         whoami          │                 'List the current login info'                 │
│          clear          │                     'Clears this screen'                      │
│          quit           │                      'Exit this program'                      │
└─────────────────────────┴───────────────────────────────────────────────────────────────┘
```


 
## Execute bulk of commands
Create a commands.txt file and type in the commands in that file
command.txt
```text
update subnetworks -all
export subnetworks -new
```


> uncli --portal https://utilitynetwork.esri.com/portal --service NapervilleElectric_SQLServer --user tester --password tester.108 --file commands.txt 

