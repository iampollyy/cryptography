// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

contract GameCharacterCollectionERC1155 is ERC1155, Ownable {
    using Strings for uint256;

    uint256 public constant NUM_CHARACTERS = 10;

    string public name = "GameCharacterCollection";
    string public symbol = "GCC";

    struct CharacterAttributes {
        string characterName;
        string rarity;
        uint256 strength;
        uint256 speed;
        string color;
        string emoji;
    }

    mapping(uint256 => CharacterAttributes) public characters;

    event CharacterMinted(
        address indexed to,
        uint256 indexed tokenId,
        uint256 amount
    );

    event BatchCharactersMinted(
        address indexed to,
        uint256[] tokenIds,
        uint256[] amounts
    );

    constructor(
        address initialOwner
    ) ERC1155("") Ownable(initialOwner) {
        _initCharacter(0, "Fire Mage",       "Legendary",  90, 60, "#ff4500", unicode"🔥");
        _initCharacter(1, "Ice Archer",      "Epic",       70, 85, "#00bfff", unicode"🧊");
        _initCharacter(2, "Shadow Rogue",    "Rare",       65, 95, "#8b00ff", unicode"🗡️");
        _initCharacter(3, "Earth Guardian",  "Legendary",  95, 40, "#228b22", unicode"🛡️");
        _initCharacter(4, "Wind Dancer",     "Epic",       55, 99, "#87ceeb", unicode"💨");
        _initCharacter(5, "Thunder Knight",  "Rare",       88, 70, "#ffd700", unicode"⚡");
        _initCharacter(6, "Water Healer",    "Uncommon",   40, 60, "#4169e1", unicode"💧");
        _initCharacter(7, "Dark Warlock",    "Legendary",  92, 50, "#4b0082", unicode"🌑");
        _initCharacter(8, "Light Paladin",   "Epic",       85, 75, "#fffacd", unicode"✨");
        _initCharacter(9, "Void Assassin",   "Rare",       78, 90, "#2f4f4f", unicode"🌀");
    }

    function _initCharacter(
        uint256 id,
        string memory _name,
        string memory _rarity,
        uint256 _strength,
        uint256 _speed,
        string memory _color,
        string memory _emoji
    ) internal {
        characters[id] = CharacterAttributes({
            characterName: _name,
            rarity: _rarity,
            strength: _strength,
            speed: _speed,
            color: _color,
            emoji: _emoji
        });
    }

    function mint(
        address to,
        uint256 id,
        uint256 amount
    ) external onlyOwner {
        require(id < NUM_CHARACTERS, "Invalid character ID");
        _mint(to, id, amount, "");
        emit CharacterMinted(to, id, amount);
    }

    function mintBatch(
        address to,
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external onlyOwner {
        for (uint256 i = 0; i < ids.length; i++) {
            require(ids[i] < NUM_CHARACTERS, "Invalid character ID");
        }
        _mintBatch(to, ids, amounts, "");
        emit BatchCharactersMinted(to, ids, amounts);
    }

    function _generateSVG(uint256 tokenId) internal view returns (string memory) {
        CharacterAttributes storage c = characters[tokenId];
        return string(abi.encodePacked(
            _svgHeader(c),
            _svgCharacterInfo(c),
            _svgBars(c, tokenId)
        ));
    }

    function _svgHeader(CharacterAttributes storage c) internal view returns (string memory) {
        return string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400">',
            '<defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">'
            '<stop offset="0%" style="stop-color:#0f0c29"/>'
            '<stop offset="50%" style="stop-color:#302b63"/>'
            '<stop offset="100%" style="stop-color:#24243e"/>'
            '</linearGradient></defs>',
            '<rect width="300" height="400" rx="15" fill="url(#bg)"/>',
            '<rect x="5" y="5" width="290" height="390" rx="12" fill="none" stroke="', c.color, '" stroke-width="3"/>',
            '<circle cx="150" cy="90" r="50" fill="', c.color, '" opacity="0.2"/>',
            '<text x="150" y="105" text-anchor="middle" font-size="50">', c.emoji, '</text>'
        ));
    }

    function _svgCharacterInfo(CharacterAttributes storage c) internal view returns (string memory) {
        return string(abi.encodePacked(
            '<text x="150" y="170" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" font-weight="bold" fill="white">', c.characterName, '</text>',
            '<rect x="90" y="180" width="120" height="24" rx="12" fill="', c.color, '"/>',
            '<text x="150" y="197" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" font-weight="bold" fill="white">', c.rarity, '</text>'
        ));
    }

    function _svgBars(CharacterAttributes storage c, uint256 tokenId) internal view returns (string memory) {
        string memory strBarW = (c.strength * 180 / 100).toString();
        string memory spdBarW = (c.speed * 180 / 100).toString();

        return string(abi.encodePacked(
            '<text x="30" y="240" font-family="Arial,sans-serif" font-size="12" fill="#aaa">STR</text>',
            '<rect x="70" y="228" width="180" height="16" rx="8" fill="#333"/>',
            '<rect x="70" y="228" width="', strBarW, '" height="16" rx="8" fill="', c.color, '"/>',
            '<text x="255" y="240" font-family="Arial,sans-serif" font-size="12" fill="white">', c.strength.toString(), '</text>',
            _svgSpeedBar(c, spdBarW),
            '<text x="150" y="350" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" fill="#555">Game Character Collection</text>',
            '<text x="150" y="370" text-anchor="middle" font-family="monospace" font-size="10" fill="#555">#', tokenId.toString(), '</text>',
            '</svg>'
        ));
    }

    function _svgSpeedBar(CharacterAttributes storage c, string memory spdBarW) internal view returns (string memory) {
        return string(abi.encodePacked(
            '<text x="30" y="275" font-family="Arial,sans-serif" font-size="12" fill="#aaa">SPD</text>',
            '<rect x="70" y="263" width="180" height="16" rx="8" fill="#333"/>',
            '<rect x="70" y="263" width="', spdBarW, '" height="16" rx="8" fill="', c.color, '"/>',
            '<text x="255" y="275" font-family="Arial,sans-serif" font-size="12" fill="white">', c.speed.toString(), '</text>'
        ));
    }

    function uri(uint256 tokenId) public view override returns (string memory) {
        require(tokenId < NUM_CHARACTERS, "Invalid character ID");

        CharacterAttributes storage c = characters[tokenId];

        string memory svgBase64 = Base64.encode(bytes(_generateSVG(tokenId)));
        string memory imageURI = string(abi.encodePacked("data:image/svg+xml;base64,", svgBase64));

        string memory json = string(abi.encodePacked(
            '{"name":"', c.characterName,
            '","description":"Game character NFT from the GameCharacterCollection (ERC-1155)."',
            ',"image":"', imageURI,
            '","attributes":[',
            '{"trait_type":"Character Name","value":"', c.characterName, '"},',
            '{"trait_type":"Rarity","value":"', c.rarity, '"},',
            '{"trait_type":"Strength","display_type":"number","value":', c.strength.toString(), '},',
            '{"trait_type":"Speed","display_type":"number","value":', c.speed.toString(), '}',
            ']}'
        ));

        return string(abi.encodePacked(
            "data:application/json;base64,",
            Base64.encode(bytes(json))
        ));
    }

    function getCharacter(
        uint256 id
    )
        external
        view
        returns (
            string memory characterName,
            string memory rarity,
            uint256 strength,
            uint256 speed,
            string memory color
        )
    {
        require(id < NUM_CHARACTERS, "Invalid character ID");
        CharacterAttributes storage c = characters[id];
        return (c.characterName, c.rarity, c.strength, c.speed, c.color);
    }
}
