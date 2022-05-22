import xml.etree.ElementTree as ET

# Settings
input_file = '/Volumes/SebrGondwana/Projects/BIMOK/DIT/RUSHES CDLs/CDL Collections/combined.cdl'

output_header_line = 'Clip Name,SOP,SAT'
output_line = '{clip_name},({slope})({offset})({power}),{saturation}'

# Work
tree = ET.parse(input_file)
root = tree.getroot()

# Save the namespace for use in subsequent searching
ns = {
    'cdl': 'urn:ASC:CDL:v1.01'
}

count_cdl = 0
cdls = []
for ColorDecision in root:
    cdl = {}

    ColorCorrection = ColorDecision[0]
    # Name: <ColorCorrection id="B001C002_220507_R6VL">
    cdl['clip_name'] = ColorCorrection.attrib['id']
    count_cdl += 1
    
    # Then colour information
    cdl['slope'] = ColorCorrection.find('cdl:SOPNode/cdl:Slope', ns).text
    cdl['offset'] = ColorCorrection.find('cdl:SOPNode/cdl:Offset', ns).text
    cdl['power'] = ColorCorrection.find('cdl:SOPNode/cdl:Power', ns).text
    cdl['saturation'] = ColorCorrection.find('cdl:SATNode/cdl:Saturation', ns).text

    cdls.append(cdl)


# print('# Parsed {} colour decision entries.'.format(count_cdl))

# Output

print(output_header_line)
for cdl in cdls:
    print(output_line.format(**cdl))