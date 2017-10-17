var React = require('react')
var ReactNative = require('react-native')
var htmlparser = require('./vendor/htmlparser2')
var entities = require('./vendor/entities')

var {
  Text,
  View,
  StyleSheet
} = ReactNative

var Image = require('./helper/Image')


var LINE_BREAK = '\n'
var PARAGRAPH_BREAK = '\n\n'
var BULLET = '\u2022 '
var BLOCKS = new Set(['ul', 'ol', 'li']);
var renderStyles = StyleSheet.create({
  bullet: {
    position: 'absolute',
    left: -20
  },
  li: {
    position: 'relative'
  }
})

function htmlToElement(rawHtml, opts, done) {
  function domToElement(dom, parent) {
    if (!dom) return null

    return dom.map((node, index, list) => {
      if (opts.customRenderer) {
        var rendered = opts.customRenderer(node, index, list)
        if (rendered || rendered === null) return rendered
      }

      if (node.type == 'text') {
        return (
          <Text key={index} style={opts.styles && (parent.type !== 'tag' || !opts.styles[parent.name]) ? opts.styles.rootStyles : null}>
            {entities.decodeHTML(node.data)}
          </Text>
        )
      }

      if (node.type == 'tag') {
        if (node.name == 'img') {
          var img_w = +node.attribs['width'] || +node.attribs['data-width'] || 0
          var img_h = +node.attribs['height'] || +node.attribs['data-height'] || 0

          var img_style = {
            width: img_w,
            height: img_h,
          }
          var source = {
            uri: node.attribs.src,
            width: img_w,
            height: img_h,
          }
          return (
            <Image key={index} source={source} style={img_style} />
          )
        }

        var linkPressHandler = null
        if (node.name == 'a' && node.attribs && node.attribs.href) {
          linkPressHandler = () => opts.linkHandler(entities.decodeHTML(node.attribs.href))
        }

        var Renderer = BLOCKS.has(node.name) && allAncestorsAreBlocks(node) ? View : Text
        var rootStyles = opts.styles ? opts.styles.rootStyles : null
        return (
          <Renderer
            key={index}
            onPress={linkPressHandler}
            style={[
              Renderer === Text ? rootStyles : null,
              opts.styles[node.name],
              renderStyles[node.name]
            ]}
          >
            {node.name == 'pre' ? LINE_BREAK : null}
            {node.name == 'li' ? (
              <Text style={[rootStyles, renderStyles.bullet]}>{BULLET}</Text>
            ): null}
            {Renderer === View ?
              renderBlockChildren(node.children, node) :
              domToElement(node.children, node)
            }

            {node.name == 'p' && index < list.length - 1 ? PARAGRAPH_BREAK : null}
            {node.name == 'br' || node.name == 'h1' || node.name == 'h2' || node.name == 'h3' || node.name == 'h4' || node.name == 'h5' ? LINE_BREAK : null}
          </Renderer>
        )
      }
    })
  }

  // wraps all inline children inside a <Text> to avoid block layout on them
  function renderBlockChildren (children, parent) {
    var groups = [] // a group is a block child or array of inline children, e.g. [[inline, inline], block, [inline]]
    var curIndex = 0
    for (var i = 0; i < children.length; i++) {
      var child = children[i]
      if (BLOCKS.has(child.name)) {
        groups.push(child)
        curIndex = groups.length
      } else {
        if (Array.isArray(groups[curIndex])) {
          groups[curIndex].push(child)
        } else {
          groups[curIndex] = [child]
        }
      }
    }

    return groups.map(function (group, index) {
      return Array.isArray(group) ?
        <Text key={index}>{domToElement(group, parent)}</Text> :
        domToElement([group], parent)
    })
  }

  var handler = new htmlparser.DomHandler(function(err, dom) {
    if (err) done(err)
    done(null, domToElement(dom))
  })
  var parser = new htmlparser.Parser(handler)
  parser.write(rawHtml)
  parser.done()
}

function allAncestorsAreBlocks (node) {
  if (!node || !node.parent) {
    return true
  }

  return node.parent.type === 'tag' && BLOCKS.has(node.parent.name) && allAncestorsAreBlocks(node.parent.parent)
}

module.exports = htmlToElement
